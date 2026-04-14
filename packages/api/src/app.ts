import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { onError } from './middleware/error-handler.js';
import { serializeMiddleware } from './middleware/serialize.js';
import { authRoutes } from './routes/auth.js';
import { organizationRoutes } from './routes/organizations.js';
import { serviceRoutes } from './routes/services.js';
import { environmentRoutes } from './routes/environments.js';
import { walletRoutes } from './routes/wallets.js';
import { routeRoutes } from './routes/routes.js';
import { pricingRoutes } from './routes/pricing.js';
import { manifestRoutes } from './routes/manifests.js';
import { eventRoutes } from './routes/events.js';
import { settlementRoutes } from './routes/settlements.js';
import { discoveryRoutes } from './routes/discovery.js';
import { webhookRoutes } from './routes/webhooks.js';

export const app = new Hono();

app.use('*', logger());
app.use('*', cors());
app.use('*', serializeMiddleware);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/auth', authRoutes);
app.route('/organizations', organizationRoutes);
app.route('/services', serviceRoutes);
app.route('/', environmentRoutes);
app.route('/', walletRoutes);
app.route('/', routeRoutes);
app.route('/', pricingRoutes);
app.route('/', manifestRoutes);
app.route('/', eventRoutes);
app.route('/', settlementRoutes);
app.route('/', discoveryRoutes);
app.route('/', webhookRoutes);

app.onError(onError);

export type AppType = typeof app;
