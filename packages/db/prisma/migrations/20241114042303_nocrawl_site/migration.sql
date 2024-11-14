-- CreateEnum
CREATE TYPE "NoCrawlReason" AS ENUM ('MANUAL', 'PAGE_LIMIT_EXCEEDED');

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "noCrawl" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noCrawlReason" "NoCrawlReason";
