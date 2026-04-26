ALTER TABLE "settlements" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "next_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD COLUMN "delivered_at" timestamp with time zone;
