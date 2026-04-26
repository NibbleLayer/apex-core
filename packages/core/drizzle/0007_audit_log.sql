CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "actor_id" text,
  "actor_type" text,
  "action" text NOT NULL,
  "resource" text NOT NULL,
  "resource_id" text,
  "payload" text,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_org" ON "audit_log" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_resource" ON "audit_log" USING btree ("resource","resource_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_log_created" ON "audit_log" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
