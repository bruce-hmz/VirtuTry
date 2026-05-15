CREATE TABLE "clothing" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"tags" text[],
	"image_url" text NOT NULL,
	"image_base64" text,
	"uploaded_by" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "try_on_quota" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quota_type" varchar(20) NOT NULL,
	"quota_limit" integer NOT NULL,
	"quota_used" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_try_on" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"person_image_url" text NOT NULL,
	"person_image_base64" text,
	"clothing_ids" text[],
	"result_image_url" text,
	"result_image_base64" text,
	"has_watermark" boolean DEFAULT true NOT NULL,
	"credits_used" integer DEFAULT 50 NOT NULL,
	"seedream_task_id" varchar(255),
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clothing" ADD CONSTRAINT "clothing_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "try_on_quota" ADD CONSTRAINT "try_on_quota_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "virtual_try_on" ADD CONSTRAINT "virtual_try_on_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clothing_category_idx" ON "clothing" USING btree ("category");--> statement-breakpoint
CREATE INDEX "try_on_quota_user_id_quota_type_idx" ON "try_on_quota" USING btree ("user_id","quota_type");--> statement-breakpoint
CREATE INDEX "try_on_quota_reset_at_idx" ON "try_on_quota" USING btree ("reset_at");--> statement-breakpoint
CREATE INDEX "virtual_try_on_user_id_idx" ON "virtual_try_on" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "virtual_try_on_seedream_task_id_idx" ON "virtual_try_on" USING btree ("seedream_task_id");