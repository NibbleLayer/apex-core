import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@nibblelayer/apex-persistence/db';

export type DrizzleInstance = NodePgDatabase<typeof schema>;
