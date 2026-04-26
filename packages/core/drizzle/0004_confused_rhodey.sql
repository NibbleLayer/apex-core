ALTER TABLE "discovery_metadata" ADD COLUMN "review_status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
UPDATE "discovery_metadata" SET "review_status" = 'published' WHERE "published" = true;--> statement-breakpoint
ALTER TABLE "discovery_metadata" ADD COLUMN "indexing_status" text DEFAULT 'not_submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "discovery_metadata" ADD COLUMN "indexing_error" text;--> statement-breakpoint
ALTER TABLE "discovery_metadata" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
