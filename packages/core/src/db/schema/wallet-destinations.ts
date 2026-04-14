import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { services } from './services.js';
import { environments } from './environments.js';

export const walletDestinations = pgTable('wallet_destinations', {
  id: text('id').primaryKey(),
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id, { onDelete: 'cascade' }),
  environmentId: text('environment_id')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),
  /** ERC-20 contract address or 'native' */
  token: text('token').notNull(),
  /** CAIP-2 network identifier */
  network: text('network').notNull(),
  label: text('label'),
  active: boolean('active').notNull().default(true),
});
