ALTER TABLE "extraction_records" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "project_assets" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "task_records" ALTER COLUMN "created_at" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "task_records" ALTER COLUMN "updated_at" SET DATA TYPE bigint;