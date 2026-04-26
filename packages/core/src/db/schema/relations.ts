import { relations } from 'drizzle-orm';
import { organizations } from './organizations.js';
import { services } from './services.js';
import { environments } from './environments.js';
import { walletDestinations } from './wallet-destinations.js';
import { routes } from './routes.js';
import { priceRules } from './price-rules.js';
import { serviceManifests } from './service-manifests.js';
import { serviceDomains } from './service-domains.js';
import { paymentEvents } from './payment-events.js';
import { settlements } from './settlements.js';
import { discoveryMetadata } from './discovery-metadata.js';
import { webhookEndpoints } from './webhook-endpoints.js';
import { webhookDeliveries } from './webhook-deliveries.js';
import { apiKeys } from './api-keys.js';
import { sdkTokens } from './sdk-tokens.js';
import { auditLog } from './audit-log.js';

// ─── Organizations ──────────────────────────────────────────────────────────

export const organizationsRelations = relations(organizations, ({ many }) => ({
  services: many(services),
  apiKeys: many(apiKeys),
  sdkTokens: many(sdkTokens),
  serviceDomains: many(serviceDomains),
  auditLogs: many(auditLog),
}));

// ─── Services ───────────────────────────────────────────────────────────────

export const servicesRelations = relations(services, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [services.organizationId],
    references: [organizations.id],
  }),
  environments: many(environments),
  routes: many(routes),
  walletDestinations: many(walletDestinations),
  webhookEndpoints: many(webhookEndpoints),
  manifests: many(serviceManifests),
  domains: many(serviceDomains),
  paymentEvents: many(paymentEvents),
  settlements: many(settlements),
  sdkTokens: many(sdkTokens),
}));

// ─── Service Domains ───────────────────────────────────────────────────────

export const serviceDomainsRelations = relations(serviceDomains, ({ one }) => ({
  organization: one(organizations, {
    fields: [serviceDomains.organizationId],
    references: [organizations.id],
  }),
  service: one(services, {
    fields: [serviceDomains.serviceId],
    references: [services.id],
  }),
}));

// ─── Environments ───────────────────────────────────────────────────────────

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  service: one(services, {
    fields: [environments.serviceId],
    references: [services.id],
  }),
  walletDestinations: many(walletDestinations),
  manifests: many(serviceManifests),
}));

// ─── Wallet Destinations ───────────────────────────────────────────────────

export const walletDestinationsRelations = relations(walletDestinations, ({ one }) => ({
  service: one(services, {
    fields: [walletDestinations.serviceId],
    references: [services.id],
  }),
  environment: one(environments, {
    fields: [walletDestinations.environmentId],
    references: [environments.id],
  }),
}));

// ─── Routes ─────────────────────────────────────────────────────────────────

export const routesRelations = relations(routes, ({ one, many }) => ({
  service: one(services, {
    fields: [routes.serviceId],
    references: [services.id],
  }),
  priceRules: many(priceRules),
  paymentEvents: many(paymentEvents),
  settlements: many(settlements),
  discoveryMetadata: many(discoveryMetadata),
}));

// ─── Price Rules ────────────────────────────────────────────────────────────

export const priceRulesRelations = relations(priceRules, ({ one }) => ({
  route: one(routes, {
    fields: [priceRules.routeId],
    references: [routes.id],
  }),
}));

// ─── Service Manifests ─────────────────────────────────────────────────────

export const serviceManifestsRelations = relations(serviceManifests, ({ one }) => ({
  service: one(services, {
    fields: [serviceManifests.serviceId],
    references: [services.id],
  }),
  environment: one(environments, {
    fields: [serviceManifests.environmentId],
    references: [environments.id],
  }),
}));

// ─── Payment Events ────────────────────────────────────────────────────────

export const paymentEventsRelations = relations(paymentEvents, ({ one, many }) => ({
  service: one(services, {
    fields: [paymentEvents.serviceId],
    references: [services.id],
  }),
  route: one(routes, {
    fields: [paymentEvents.routeId],
    references: [routes.id],
  }),
  settlements: many(settlements),
  webhookDeliveries: many(webhookDeliveries),
}));

// ─── Settlements ────────────────────────────────────────────────────────────

export const settlementsRelations = relations(settlements, ({ one }) => ({
  service: one(services, {
    fields: [settlements.serviceId],
    references: [services.id],
  }),
  route: one(routes, {
    fields: [settlements.routeId],
    references: [routes.id],
  }),
  paymentEvent: one(paymentEvents, {
    fields: [settlements.paymentEventId],
    references: [paymentEvents.id],
  }),
}));

// ─── Discovery Metadata ────────────────────────────────────────────────────

export const discoveryMetadataRelations = relations(discoveryMetadata, ({ one }) => ({
  route: one(routes, {
    fields: [discoveryMetadata.routeId],
    references: [routes.id],
  }),
}));

// ─── Webhook Endpoints ─────────────────────────────────────────────────────

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  service: one(services, {
    fields: [webhookEndpoints.serviceId],
    references: [services.id],
  }),
  deliveries: many(webhookDeliveries),
}));

// ─── Webhook Deliveries ────────────────────────────────────────────────────

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.webhookEndpointId],
    references: [webhookEndpoints.id],
  }),
  event: one(paymentEvents, {
    fields: [webhookDeliveries.eventId],
    references: [paymentEvents.id],
  }),
}));

// ─── API Keys ───────────────────────────────────────────────────────────────

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
}));

// ─── SDK Tokens ─────────────────────────────────────────────────────────────

export const sdkTokensRelations = relations(sdkTokens, ({ one }) => ({
  organization: one(organizations, {
    fields: [sdkTokens.organizationId],
    references: [organizations.id],
  }),
  service: one(services, {
    fields: [sdkTokens.serviceId],
    references: [services.id],
  }),
}));

// ─── Audit Log ──────────────────────────────────────────────────────────────

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLog.organizationId],
    references: [organizations.id],
  }),
}));
