CREATE TABLE "sdk_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"service_id" text NOT NULL,
	"environment_mode" text NOT NULL,
	"key_hash" text NOT NULL,
	"label" text,
	"scopes" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "sdk_tokens_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "sdk_tokens" ADD CONSTRAINT "sdk_tokens_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sdk_tokens" ADD CONSTRAINT "sdk_tokens_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;