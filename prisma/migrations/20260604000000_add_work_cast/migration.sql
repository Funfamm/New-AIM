-- CreateTable
CREATE TABLE "work_cast" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "character" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "instagramUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_cast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_cast_workId_idx" ON "work_cast"("workId");

-- CreateIndex
CREATE INDEX "work_cast_sortOrder_idx" ON "work_cast"("sortOrder");

-- AddForeignKey
ALTER TABLE "work_cast" ADD CONSTRAINT "work_cast_workId_fkey" FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
