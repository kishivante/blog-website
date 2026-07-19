ALTER TYPE "ProfileVisibility" ADD VALUE IF NOT EXISTS 'AUTHENTICATED';

ALTER TABLE "UserPrivacySetting"
  ADD COLUMN "showFollowing" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showCommentHistory" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showWikiContributions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showOnlineStatus" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "UserBlock" (
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId", "blockedId"),
  CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserBlock_not_self" CHECK ("blockerId" <> "blockedId")
);

CREATE INDEX "UserBlock_blockedId_createdAt_idx" ON "UserBlock"("blockedId", "createdAt");

CREATE TABLE "UsernameHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "previousUsername" TEXT NOT NULL,
  "normalizedUsername" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsernameHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UsernameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UsernameHistory_normalizedUsername_key" ON "UsernameHistory"("normalizedUsername");
CREATE INDEX "UsernameHistory_userId_changedAt_idx" ON "UsernameHistory"("userId", "changedAt");

CREATE TABLE "UsernameReservation" (
  "normalizedUsername" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reservedUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsernameReservation_pkey" PRIMARY KEY ("normalizedUsername")
);

CREATE INDEX "UsernameReservation_reservedUntil_idx" ON "UsernameReservation"("reservedUntil");

CREATE TABLE "EmailChangeRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "newEmail" TEXT NOT NULL,
  "normalizedNewEmail" TEXT NOT NULL,
  "oldEmailTokenHash" TEXT NOT NULL,
  "newEmailTokenHash" TEXT NOT NULL,
  "oldEmailVerifiedAt" TIMESTAMP(3),
  "newEmailVerifiedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailChangeRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailChangeRequest_oldEmailTokenHash_key" ON "EmailChangeRequest"("oldEmailTokenHash");
CREATE UNIQUE INDEX "EmailChangeRequest_newEmailTokenHash_key" ON "EmailChangeRequest"("newEmailTokenHash");
CREATE INDEX "EmailChangeRequest_userId_createdAt_idx" ON "EmailChangeRequest"("userId", "createdAt");
CREATE INDEX "EmailChangeRequest_normalizedNewEmail_expiresAt_idx" ON "EmailChangeRequest"("normalizedNewEmail", "expiresAt");

CREATE TABLE "AccountDeletionRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "executeAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountDeletionRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "AccountDeletionRequest_userId_createdAt_idx" ON "AccountDeletionRequest"("userId", "createdAt");
CREATE INDEX "AccountDeletionRequest_executeAt_completedAt_idx" ON "AccountDeletionRequest"("executeAt", "completedAt");
