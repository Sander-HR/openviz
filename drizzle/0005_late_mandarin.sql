CREATE TABLE "extraction_records" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"source_image_id" text NOT NULL,
	"kind" text NOT NULL,
	"sample_by" text NOT NULL,
	"components" jsonb NOT NULL,
	"confidence" real NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"kind" text NOT NULL,
	"extraction_record_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_records" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"request" jsonb NOT NULL,
	"resolved" jsonb NOT NULL,
	"protocol" text NOT NULL,
	"model_family" text,
	"seeds" jsonb NOT NULL,
	"status" text NOT NULL,
	"queue_position_at_submit" integer,
	"error" text,
	"output_ids" jsonb NOT NULL,
	"created_at" integer NOT NULL,
	"updated_at" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "extraction_records" ADD CONSTRAINT "extraction_records_task_id_task_records_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assets" ADD CONSTRAINT "project_assets_extraction_record_id_extraction_records_id_fk" FOREIGN KEY ("extraction_record_id") REFERENCES "public"."extraction_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "extraction_records_task_id_idx" ON "extraction_records" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "project_assets_project_id_idx" ON "project_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_records_project_id_idx" ON "task_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_records_status_idx" ON "task_records" USING btree ("status");