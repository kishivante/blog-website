ALTER TABLE "ThemeSetting"
ADD COLUMN "baseFontSize" INTEGER NOT NULL DEFAULT 16;

ALTER TABLE "ThemeSetting"
ADD CONSTRAINT "ThemeSetting_baseFontSize_check"
CHECK ("baseFontSize" BETWEEN 14 AND 20);
