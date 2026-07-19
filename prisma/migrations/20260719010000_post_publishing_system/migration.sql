ALTER TABLE "Post" ADD COLUMN "seriesId" TEXT;
ALTER TABLE "Post" ADD COLUMN "seriesOrder" INTEGER;

CREATE TABLE "PostSlugRedirect" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "oldSlug" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostSlugRedirect_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostSlugRedirect_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PostSlugRedirect_oldSlug_key" ON "PostSlugRedirect"("oldSlug");
CREATE INDEX "PostSlugRedirect_postId_createdAt_idx" ON "PostSlugRedirect"("postId", "createdAt");

CREATE TABLE "Series" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "creatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Series_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Series_slug_key" ON "Series"("slug");
CREATE INDEX "Series_active_name_idx" ON "Series"("active", "name");

ALTER TABLE "Post" ADD CONSTRAINT "Post_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Post_seriesId_seriesOrder_idx" ON "Post"("seriesId", "seriesOrder");
