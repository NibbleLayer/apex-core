import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../src/db/schema/index.js';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://apex:apex_dev@localhost:5433/apex_dev';

const pool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5433,
  user: process.env.DB_USER || 'apex',
  password: process.env.DB_PASSWORD || 'apex_dev',
  database: process.env.DB_NAME || 'apex_dev',
});

export const db = drizzle(pool, { schema });
export { pool };
