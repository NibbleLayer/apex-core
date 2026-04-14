import type { ApexManifest } from '@nibblelayer/apex-contracts';
import type { MiddlewareHandler } from 'hono';

/**
 * Create Hono middleware from an Apex manifest.
 *
 * In production with @x402/hono installed, this uses the real payment middleware.
 * Falls back to adapter implementation if @x402/hono is not available.
 */
export async function createMiddlewareFromManifest(
  manifest: ApexManifest,
  eventEmitter: (type: string, data: Record<string, unknown>) => void,
): Promise<MiddlewareHandler> {
  // Try to use real @x402/hono
  try {
    const x402Hono = await import('@x402/hono');
    const x402Core = await import('@x402/core/server');
    const x402Evm = await import('@x402/evm/exact/server');

    const facilitatorClient = new x402Core.HTTPFacilitatorClient({
      url: manifest.facilitatorUrl,
    });

    const resourceServer = new x402Core.x402ResourceServer(facilitatorClient)
      .register('eip155:*', new x402Evm.ExactEvmScheme());

    // Register lifecycle hooks for event emission
    resourceServer
      .onAfterVerify(async (ctx: any) => {
        eventEmitter('payment.verified', {
          paymentPayload: ctx.paymentPayload,
          requirements: ctx.requirements,
          result: ctx.result,
        });
      })
      .onAfterSettle(async (ctx: any) => {
        eventEmitter('payment.settled', {
          paymentPayload: ctx.paymentPayload,
          requirements: ctx.requirements,
          result: ctx.result,
        });
      })
      .onVerifyFailure(async (ctx: any) => {
        eventEmitter('payment.failed', {
          paymentPayload: ctx.paymentPayload,
          requirements: ctx.requirements,
          error: ctx.error,
        });
      })
      .onSettleFailure(async (ctx: any) => {
        eventEmitter('payment.failed', {
          paymentPayload: ctx.paymentPayload,
          requirements: ctx.requirements,
          error: ctx.error,
        });
      });

    // Build the routes config — manifest routes map directly to x402 RoutesConfig
    // because they share the same "METHOD /path" key format and accepts structure.
    const routes: Record<string, any> = {};
    for (const [key, route] of Object.entries(manifest.routes)) {
      routes[key] = {
        accepts: route.accepts.map((a) => ({
          scheme: a.scheme,
          payTo: a.payTo,
          price: a.price,
          network: a.network,
        })),
        ...(route.description && { description: route.description }),
        ...(route.mimeType && { mimeType: route.mimeType }),
        ...(route.extensions && { extensions: route.extensions }),
      };
    }

    return x402Hono.paymentMiddleware(routes, resourceServer);
  } catch {
    // Fall back to adapter when @x402/hono is not available
    const { createPaymentMiddleware } = await import('./x402-adapter.js');
    return createPaymentMiddleware(manifest);
  }
}
