CREATE TABLE "WikiLink" (
  "sourceId" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WikiLink_pkey" PRIMARY KEY ("sourceId", "targetId")
);

CREATE INDEX "WikiLink_targetId_idx" ON "WikiLink"("targetId");

ALTER TABLE "WikiLink"
  ADD CONSTRAINT "WikiLink_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "WikiPage"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WikiLink"
  ADD CONSTRAINT "WikiLink_targetId_fkey"
  FOREIGN KEY ("targetId") REFERENCES "WikiPage"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "WikiPage_full_text_idx"
ON "WikiPage"
USING GIN (
  to_tsvector(
    'simple',
    coalesce("title", '') || ' ' ||
    coalesce("summary", '') || ' ' ||
    coalesce("renderedContent", '')
  )
);
