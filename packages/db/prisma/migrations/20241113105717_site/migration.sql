/*
  Warnings:

  - Added the required column `external` to the `Link` table without a default value. This is not possible if the table is not empty.
  - Added the required column `siteId` to the `Page` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "external" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "siteId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SiteBacklinks" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_origin_key" ON "Site"("origin");

-- CreateIndex
CREATE UNIQUE INDEX "_SiteBacklinks_AB_unique" ON "_SiteBacklinks"("A", "B");

-- CreateIndex
CREATE INDEX "_SiteBacklinks_B_index" ON "_SiteBacklinks"("B");

-- CreateIndex
CREATE INDEX "Page_crawled_idx" ON "Page"("crawled");

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SiteBacklinks" ADD CONSTRAINT "_SiteBacklinks_A_fkey" FOREIGN KEY ("A") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SiteBacklinks" ADD CONSTRAINT "_SiteBacklinks_B_fkey" FOREIGN KEY ("B") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
