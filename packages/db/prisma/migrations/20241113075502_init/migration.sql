-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "crawled" BOOLEAN NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "content" TEXT,
    "url" TEXT NOT NULL,
    "lastCrawl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Link_fromId_toId_key" ON "Link"("fromId", "toId");

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Page"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
