-- New analytics event types for the production-breakdown funnel.
-- Additive enum values: safe single-step (PG 12+ allows ADD VALUE in a
-- transaction as long as the value isn't used in the same transaction).
ALTER TYPE "AnalyticsEventType" ADD VALUE 'PROCESS_CLICK';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'GUIDE_DOWNLOAD';
