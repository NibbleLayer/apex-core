ALTER TABLE "routes" ADD COLUMN "source" text DEFAULT 'dashboard' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "publication_status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;