-- CreateTable: subtitles
CREATE TABLE "subtitles" (
    "id"               TEXT NOT NULL,
    "workId"           TEXT NOT NULL,
    "mediaType"        TEXT NOT NULL DEFAULT 'full',
    "sourceLanguage"   TEXT NOT NULL DEFAULT 'en',
    "label"            TEXT NOT NULL DEFAULT 'English',
    "segmentsJson"     JSONB NOT NULL,
    "translationsJson" JSONB,
    "vttKeysJson"      JSONB,
    "isPublished"      BOOLEAN NOT NULL DEFAULT false,
    "isDefault"        BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtitles_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subtitle_revisions
CREATE TABLE "subtitle_revisions" (
    "id"           TEXT NOT NULL,
    "subtitleId"   TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "reason"       TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subtitle_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: subtitle_jobs
CREATE TABLE "subtitle_jobs" (
    "id"            TEXT NOT NULL,
    "subtitleId"    TEXT NOT NULL,
    "type"          TEXT NOT NULL DEFAULT 'translate',
    "status"        TEXT NOT NULL DEFAULT 'PENDING',
    "languagesJson" JSONB,
    "progress"      INTEGER NOT NULL DEFAULT 0,
    "error"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtitle_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "subtitles_workId_mediaType_sourceLanguage_key"
    ON "subtitles"("workId", "mediaType", "sourceLanguage");

-- CreateIndex
CREATE INDEX "subtitles_workId_idx" ON "subtitles"("workId");
CREATE INDEX "subtitles_mediaType_idx" ON "subtitles"("mediaType");
CREATE INDEX "subtitles_sourceLanguage_idx" ON "subtitles"("sourceLanguage");

CREATE INDEX "subtitle_revisions_subtitleId_idx" ON "subtitle_revisions"("subtitleId");

CREATE INDEX "subtitle_jobs_subtitleId_idx" ON "subtitle_jobs"("subtitleId");
CREATE INDEX "subtitle_jobs_status_idx" ON "subtitle_jobs"("status");

-- AddForeignKey
ALTER TABLE "subtitles" ADD CONSTRAINT "subtitles_workId_fkey"
    FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subtitle_revisions" ADD CONSTRAINT "subtitle_revisions_subtitleId_fkey"
    FOREIGN KEY ("subtitleId") REFERENCES "subtitles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subtitle_jobs" ADD CONSTRAINT "subtitle_jobs_subtitleId_fkey"
    FOREIGN KEY ("subtitleId") REFERENCES "subtitles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
