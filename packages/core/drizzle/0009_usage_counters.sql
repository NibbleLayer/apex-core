CREATE TABLE IF NOT EXISTS usage_counters (
  id VARCHAR PRIMARY KEY,
  organization_id VARCHAR NOT NULL,
  period VARCHAR(7) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_counters_org_period_type ON usage_counters(organization_id, period, event_type);
