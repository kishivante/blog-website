ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'WIKI';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ROLE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BADGE';

ALTER TABLE "Comment"
  ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "moderationReason" TEXT,
  ADD COLUMN "moderatedById" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Comment_moderatedById_moderatedAt_idx" ON "Comment"("moderatedById", "moderatedAt");

ALTER TABLE "Report" ADD COLUMN "dedupeKey" TEXT;
UPDATE "Report" SET "dedupeKey" = md5("reporterId" || ':' || "targetType"::text || ':' || "targetId" || ':' || "id");
ALTER TABLE "Report" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "Report_dedupeKey_key" ON "Report"("dedupeKey");

ALTER TABLE "Notification"
  ADD COLUMN "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "emailNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "emailIdempotencyKey" TEXT,
  ADD COLUMN "emailLastError" TEXT;
CREATE UNIQUE INDEX "Notification_emailIdempotencyKey_key" ON "Notification"("emailIdempotencyKey");
CREATE INDEX "Notification_emailStatus_emailNextAttemptAt_idx" ON "Notification"("emailStatus", "emailNextAttemptAt");
