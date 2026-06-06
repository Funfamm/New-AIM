-- CreateEnum
CREATE TYPE "RowPlacement" AS ENUM ('HOME', 'WORKS', 'BOTH');

-- CreateTable
CREATE TABLE "content_rows" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "placement" "RowPlacement" NOT NULL DEFAULT 'HOME',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_row_items" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_row_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_rows_slug_key" ON "content_rows"("slug");

-- CreateIndex
CREATE INDEX "content_rows_placement_active_sortOrder_idx" ON "content_rows"("placement", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "content_row_items_rowId_workId_key" ON "content_row_items"("rowId", "workId");

-- CreateIndex
CREATE INDEX "content_row_items_rowId_sortOrder_idx" ON "content_row_items"("rowId", "sortOrder");

-- CreateIndex
CREATE INDEX "content_row_items_workId_idx" ON "content_row_items"("workId");

-- AddForeignKey
ALTER TABLE "content_row_items" ADD CONSTRAINT "content_row_items_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "content_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_row_items" ADD CONSTRAINT "content_row_items_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
