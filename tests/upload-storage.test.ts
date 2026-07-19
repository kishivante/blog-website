import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalStorageAdapter } from "@/storage/local-storage-adapter";
import { assertStorageKey } from "@/storage/storage-adapter";

vi.mock("server-only", () => ({}));

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("LocalStorageAdapter entegrasyonu", () => {
  it("dosyayı kök dışında yazmadan saklar, okur, listeler ve siler", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "scarlet-storage-"));
    roots.push(root);
    const adapter = new LocalStorageAdapter(root);
    const body = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    await adapter.put({
      key: "public/avatar/user/random/main.webp",
      body,
      contentType: "image/webp",
      visibility: "public",
      contentDisposition: 'inline; filename="random.webp"',
    });
    expect(await adapter.exists("public/avatar/user/random/main.webp")).toBe(
      true,
    );
    expect(
      Array.from(
        (await adapter.get("public/avatar/user/random/main.webp"))?.body ?? [],
      ),
    ).toEqual(Array.from(body));
    expect(await adapter.list("public")).toEqual([
      "public/avatar/user/random/main.webp",
    ]);
    await adapter.delete("public/avatar/user/random/main.webp");
    expect(await adapter.exists("public/avatar/user/random/main.webp")).toBe(
      false,
    );
  });

  it("path traversal ve platform ayırıcılarını reddeder", () => {
    expect(() => assertStorageKey("../secret")).toThrow("Geçersiz");
    expect(() => assertStorageKey("public\\secret")).toThrow("Geçersiz");
    expect(() => assertStorageKey("/absolute/file")).toThrow("Geçersiz");
  });
});

describe("görsel imza doğrulaması", () => {
  it("JPEG, PNG ve WebP magic byte değerlerini tanır", async () => {
    const { detectImageFormat } = await import("@/services/upload-service");
    expect(detectImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe(
      "jpeg",
    );
    expect(
      detectImageFormat(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
    expect(
      detectImageFormat(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
    ).toBe("webp");
  });

  it("SVG, HTML ve arşiv imzalarını reddeder", async () => {
    const { detectImageFormat } = await import("@/services/upload-service");
    expect(
      detectImageFormat(new TextEncoder().encode("<svg onload='alert(1)'>")),
    ).toBeNull();
    expect(
      detectImageFormat(new TextEncoder().encode("<script>alert(1)</script>")),
    ).toBeNull();
    expect(
      detectImageFormat(new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
    ).toBeNull();
  });
});
