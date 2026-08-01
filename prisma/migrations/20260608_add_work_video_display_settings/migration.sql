CREATE TABLE "work_video_display_settings" (
  "id"                    TEXT NOT NULL,
  "workId"                TEXT NOT NULL,
  "mediaType"             TEXT NOT NULL,
  "filmstripMaskEnabled"  BOOLEAN NOT NULL DEFAULT false,
  "filmstripMaskHeight"   INTEGER NOT NULL DEFAULT 12,
  "filmstripMaskOpacity"  INTEGER NOT NULL DEFAULT 96,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL,

  CONSTRAINT "work_video_display_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "work_video_display_settings_workId_mediaType_key"
  ON "work_video_display_settings"("workId", "mediaType");

CREATE INDEX "work_video_display_settings_workId_idx"
  ON "work_video_display_settings"("workId");

CREATE INDEX "work_video_display_settings_mediaType_idx"
  ON "work_video_display_settings"("mediaType");

ALTER TABLE "work_video_display_settings"
  ADD CONSTRAINT "work_video_display_settings_workId_fkey"
  FOREIGN KEY ("workId") REFERENCES "works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
