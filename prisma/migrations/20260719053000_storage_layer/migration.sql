CREATE TABLE "UploadAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "driver" TEXT NOT NULL,
  "visibility" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "variants" JSONB NOT NULL,
  "scanStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "UploadAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UploadAsset_storageKey_key" ON "UploadAsset"("storageKey");
CREATE INDEX "UploadAsset_ownerId_createdAt_idx" ON "UploadAsset"("ownerId", "createdAt");
CREATE INDEX "UploadAsset_kind_createdAt_idx" ON "UploadAsset"("kind", "createdAt");
CREATE INDEX "UploadAsset_deletedAt_idx" ON "UploadAsset"("deletedAt");

ALTER TABLE "UploadAsset"
  ADD CONSTRAINT "UploadAsset_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
