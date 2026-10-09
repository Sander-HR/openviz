CREATE TABLE "ai_compute_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"target_kind" text DEFAULT 'local' NOT NULL,
	"protocol" text DEFAULT 'comfyui' NOT NULL,
	"preference" text DEFAULT 'automatic' NOT NULL,
	"local_endpoint" text DEFAULT '/comfy-api' NOT NULL,
	"hosted_endpoint" text DEFAULT '' NOT NULL,
	"image_api_endpoint" text DEFAULT '' NOT NULL,
	"image_api_key_ciphertext" text,
	"image_api_key_updated_at" timestamp,
	"image_api_keyless" boolean DEFAULT false NOT NULL,
	"image_api_model" text DEFAULT '' NOT NULL,
	"image_api_size" text DEFAULT '1024x1024' NOT NULL,
	"endpoint_concurrency" integer DEFAULT 2 NOT NULL,
	"active_profile_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_endpoint_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"protocol" text NOT NULL,
	"endpoint" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"image_size" text DEFAULT '1024x1024' NOT NULL,
	"keyless" boolean DEFAULT false NOT NULL,
	"has_api_key" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_compute_settings" ADD CONSTRAINT "ai_compute_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_endpoint_profiles" ADD CONSTRAINT "ai_endpoint_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_compute_settings_active_profile_idx" ON "ai_compute_settings" USING btree ("active_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_endpoint_profiles_user_name_unique" ON "ai_endpoint_profiles" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "ai_endpoint_profiles_user_idx" ON "ai_endpoint_profiles" USING btree ("user_id");