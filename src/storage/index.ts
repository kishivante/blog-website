import { getServerEnv } from "@/lib/env";
import { LocalStorageAdapter } from "@/storage/local-storage-adapter";
import { S3StorageAdapter } from "@/storage/s3-storage-adapter";
import type { StorageAdapter } from "@/storage/storage-adapter";

let adapter: StorageAdapter | undefined;
export function getStorageAdapter(): StorageAdapter {
  if (adapter) return adapter;
  const env = getServerEnv();
  if (env.UPLOAD_STORAGE_DRIVER === "local") {
    adapter = new LocalStorageAdapter(env.UPLOAD_LOCAL_PATH);
  } else {
    if (
      !env.S3_REGION ||
      !env.S3_BUCKET ||
      !env.S3_ACCESS_KEY ||
      !env.S3_SECRET_KEY
    ) {
      throw new Error(
        "S3 storage seçildi ancak gerekli secret yapılandırması eksik.",
      );
    }
    adapter = new S3StorageAdapter({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKey: env.S3_ACCESS_KEY,
      secretKey: env.S3_SECRET_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
    });
  }
  return adapter;
}
