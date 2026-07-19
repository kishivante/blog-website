import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { db } from "@/server/db";
import { getServerEnv } from "@/lib/env";
import { getStorageAdapter } from "@/storage";
import type { StorageVisibility } from "@/storage/storage-adapter";
import type { RequestContext } from "@/server/request-context";

export type UploadKind =
  | "avatar"
  | "profile-cover"
  | "post-cover"
  | "post-content"
  | "wiki-content"
  | "logo"
  | "favicon";
export type MalwareScanResult =
  | "NOT_CONFIGURED"
  | "CLEAN"
  | "INFECTED"
  | "UNAVAILABLE";
export interface MalwareScannerAdapter {
  scan(bytes: Uint8Array): Promise<MalwareScanResult>;
}
class DisabledMalwareScanner implements MalwareScannerAdapter {
  constructor(private readonly requested: boolean) {}
  async scan(): Promise<MalwareScanResult> {
    return this.requested ? "UNAVAILABLE" : "NOT_CONFIGURED";
  }
}

const signatures = {
  jpeg: (bytes: Uint8Array) =>
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  png: (bytes: Uint8Array) =>
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (value, index) => bytes[index] === value,
    ),
  webp: (bytes: Uint8Array) =>
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50,
};
export function detectImageFormat(
  bytes: Uint8Array,
): "jpeg" | "png" | "webp" | null {
  if (signatures.jpeg(bytes)) return "jpeg";
  if (signatures.png(bytes)) return "png";
  if (signatures.webp(bytes)) return "webp";
  return null;
}

const policies: Record<
  UploadKind,
  {
    maxBytes: number;
    maxWidth: number;
    maxHeight: number;
    mainWidth: number;
    thumbnailWidth: number;
  }
> = {
  avatar: {
    maxBytes: 5_000_000,
    maxWidth: 4000,
    maxHeight: 4000,
    mainWidth: 512,
    thumbnailWidth: 128,
  },
  "profile-cover": {
    maxBytes: 10_000_000,
    maxWidth: 8000,
    maxHeight: 4000,
    mainWidth: 1920,
    thumbnailWidth: 480,
  },
  "post-cover": {
    maxBytes: 12_000_000,
    maxWidth: 8000,
    maxHeight: 8000,
    mainWidth: 1920,
    thumbnailWidth: 640,
  },
  "post-content": {
    maxBytes: 12_000_000,
    maxWidth: 8000,
    maxHeight: 8000,
    mainWidth: 2048,
    thumbnailWidth: 640,
  },
  "wiki-content": {
    maxBytes: 12_000_000,
    maxWidth: 8000,
    maxHeight: 8000,
    mainWidth: 2048,
    thumbnailWidth: 640,
  },
  logo: {
    maxBytes: 5_000_000,
    maxWidth: 5000,
    maxHeight: 5000,
    mainWidth: 1024,
    thumbnailWidth: 256,
  },
  favicon: {
    maxBytes: 2_000_000,
    maxWidth: 1024,
    maxHeight: 1024,
    mainWidth: 256,
    thumbnailWidth: 64,
  },
};

function publicUrl(key: string) {
  return `/api/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}
async function uploadLimits(kind: UploadKind) {
  const env = getServerEnv();
  const site = await db.siteSetting.findUnique({
    where: { id: "default" },
    select: { maxUploadBytes: true, contentRules: true },
  });
  const rules =
    site?.contentRules &&
    typeof site.contentRules === "object" &&
    !Array.isArray(site.contentRules)
      ? (site.contentRules as Record<string, unknown>)
      : {};
  return {
    maxBytes: Math.min(
      policies[kind].maxBytes,
      site?.maxUploadBytes ?? policies[kind].maxBytes,
    ),
    maxPixels:
      typeof rules.maxUploadPixels === "number"
        ? Math.min(rules.maxUploadPixels, env.UPLOAD_MAX_PIXELS)
        : env.UPLOAD_MAX_PIXELS,
    monthlyQuota:
      typeof rules.monthlyUploadQuotaBytes === "number"
        ? Math.min(rules.monthlyUploadQuotaBytes, 2_147_000_000)
        : env.UPLOAD_MONTHLY_QUOTA_BYTES,
  };
}

export async function storeImage(input: {
  file: File;
  ownerId: string;
  kind: UploadKind;
  visibility?: StorageVisibility;
  context: RequestContext;
  scanner?: MalwareScannerAdapter;
}) {
  const limits = await uploadLimits(input.kind);
  if (input.file.size < 1 || input.file.size > limits.maxBytes)
    throw new Error(
      `Dosya boyutu ${Math.floor(limits.maxBytes / 1_000_000)} MB sınırını aşamaz.`,
    );
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const quota = await db.uploadAsset.aggregate({
    where: {
      ownerId: input.ownerId,
      createdAt: { gte: startOfMonth },
      deletedAt: null,
    },
    _sum: { byteSize: true },
  });
  if ((quota._sum.byteSize ?? 0) + input.file.size > limits.monthlyQuota)
    throw new Error("Aylık upload kotası aşıldı.");

  const source = new Uint8Array(await input.file.arrayBuffer());
  const detected = detectImageFormat(source);
  if (!detected)
    throw new Error(
      "Yalnızca gerçek JPEG, PNG veya WebP görseller kabul edilir.",
    );
  const scanner =
    input.scanner ?? new DisabledMalwareScanner(getServerEnv().CLAMAV_ENABLED);
  const scanStatus = await scanner
    .scan(source)
    .catch(() => "UNAVAILABLE" as const);
  if (scanStatus === "INFECTED")
    throw new Error("Dosya güvenlik kontrolünden geçemedi.");

  const policy = policies[input.kind];
  const image = sharp(source, {
    failOn: "error",
    limitInputPixels: limits.maxPixels,
    animated: false,
    sequentialRead: true,
  });
  const metadata = await image.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    !["jpeg", "png", "webp"].includes(metadata.format ?? "")
  )
    throw new Error("Geçerli görsel boyutları okunamadı.");
  if (
    metadata.width > policy.maxWidth ||
    metadata.height > policy.maxHeight ||
    metadata.width * metadata.height > limits.maxPixels
  )
    throw new Error("Görsel piksel boyutu güvenli sınırı aşıyor.");
  if ((metadata.pages ?? 1) > 1)
    throw new Error("Animasyonlu görseller kabul edilmez.");

  const main = await sharp(source, {
    failOn: "error",
    limitInputPixels: limits.maxPixels,
    animated: false,
  })
    .rotate()
    .resize({
      width: policy.mainWidth,
      height: policy.maxHeight,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 84, effort: 4 })
    .toBuffer();
  const thumbnail = await sharp(source, {
    failOn: "error",
    limitInputPixels: limits.maxPixels,
    animated: false,
  })
    .rotate()
    .resize({
      width: policy.thumbnailWidth,
      height: policy.thumbnailWidth,
      fit: input.kind === "avatar" ? "cover" : "inside",
      withoutEnlargement: false,
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();
  const mainMetadata = await sharp(main).metadata();
  if (!mainMetadata.width || !mainMetadata.height)
    throw new Error("İşlenen görsel doğrulanamadı.");

  const id = randomUUID();
  const prefix = `${input.visibility ?? "public"}/${input.kind}/${input.ownerId}/${id}`;
  const mainKey = `${prefix}/main.webp`;
  const thumbKey = `${prefix}/thumb.webp`;
  const storage = getStorageAdapter();
  const disposition = `inline; filename="${id}.webp"`;
  const written: string[] = [];
  try {
    await storage.put({
      key: mainKey,
      body: main,
      contentType: "image/webp",
      visibility: input.visibility ?? "public",
      contentDisposition: disposition,
    });
    written.push(mainKey);
    await storage.put({
      key: thumbKey,
      body: thumbnail,
      contentType: "image/webp",
      visibility: input.visibility ?? "public",
      contentDisposition: disposition,
    });
    written.push(thumbKey);
    const asset = await db.uploadAsset.create({
      data: {
        ownerId: input.ownerId,
        storageKey: mainKey,
        driver: storage.driver,
        visibility: input.visibility ?? "public",
        kind: input.kind,
        mimeType: "image/webp",
        byteSize: main.byteLength + thumbnail.byteLength,
        width: mainMetadata.width,
        height: mainMetadata.height,
        checksum: createHash("sha256").update(main).digest("hex"),
        variants: { main: mainKey, thumbnail: thumbKey },
        scanStatus,
      },
    });
    await db.auditLog.create({
      data: {
        actorId: input.ownerId,
        action: "IMAGE_UPLOADED",
        targetType: "UploadAsset",
        targetId: asset.id,
        newValue: {
          kind: input.kind,
          byteSize: asset.byteSize,
          width: asset.width,
          height: asset.height,
          driver: storage.driver,
          scanStatus,
        },
        ipAddress: input.context.ip,
        userAgent: input.context.userAgent,
      },
    });
    return {
      id: asset.id,
      url: publicUrl(mainKey),
      thumbnailUrl: publicUrl(thumbKey),
      width: asset.width,
      height: asset.height,
    };
  } catch (error) {
    await Promise.allSettled(written.map((key) => storage.delete(key)));
    throw error;
  }
}

export async function storeProfileImage(
  file: File,
  userId: string,
  kind: "avatar" | "cover",
  context: RequestContext,
) {
  return (
    await storeImage({
      file,
      ownerId: userId,
      kind: kind === "avatar" ? "avatar" : "profile-cover",
      context,
    })
  ).url;
}
export async function storePostImage(
  file: File,
  userId: string,
  kind: "content" | "cover",
  context: RequestContext,
  wiki = false,
) {
  return (
    await storeImage({
      file,
      ownerId: userId,
      kind: wiki
        ? "wiki-content"
        : kind === "cover"
          ? "post-cover"
          : "post-content",
      context,
    })
  ).url;
}

export async function cleanupOrphanedStorage() {
  const storage = getStorageAdapter();
  const [publicKeys, privateKeys, assets] = await Promise.all([
    storage.list("public"),
    storage.list("private"),
    db.uploadAsset.findMany({
      where: { deletedAt: null },
      select: { storageKey: true, variants: true },
    }),
  ]);
  const keys = [...publicKeys, ...privateKeys];
  const referenced = new Set<string>();
  for (const asset of assets) {
    referenced.add(asset.storageKey);
    if (
      asset.variants &&
      typeof asset.variants === "object" &&
      !Array.isArray(asset.variants)
    ) {
      for (const value of Object.values(asset.variants))
        if (typeof value === "string") referenced.add(value);
    }
  }
  const orphans = keys.filter((key) => !referenced.has(key));
  await Promise.allSettled(orphans.map((key) => storage.delete(key)));
  return orphans.length;
}
