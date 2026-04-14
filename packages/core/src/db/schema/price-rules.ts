import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { routes } from './routes.js';

export const priceRules = pgTable('price_rules', {
  id: text('id').primaryKey(),
  routeId: text('route_id')
    .notNull()
    .references(() => routes.id, { onDelete: 'cascade' }),
  scheme: text('scheme', {
    enum: ['exact'],
  })
    .notNull()
    .default('exact'),
  /** Price string, e.g., '$0.01' (infers USDC) or raw token amount */
  amount: text('amount').notNull(),
  /** ERC-20 contract address */
  token: text('token').notNull(),
  /** CAIP-2 network identifier */
  network: text('network').notNull(),
  active: boolean('active').notNull().default(true),
});
