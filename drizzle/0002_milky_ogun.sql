ALTER TABLE "jobs" ADD COLUMN "retry_of" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "metadata" jsonb;