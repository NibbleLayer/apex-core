import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apexManifestSchema,
  signedManifestEnvelopeSchema,
  buildManifestSigningMessage,
  canonicalizeJson,
  type ApexManifest,
  type SignedManifestEnvelope,
} from '@nibblelayer/apex-contracts';
import { ManifestManager } from '../src/manifest.js';
import { mockManifest } from './fixtures/manifest.mock.js';

const testDir = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSignedEnvelope(
  manifest: ApexManifest,
  apiKey: string,
  expiresAt = new Date(Date.now() + 300_000).toISOString(),
): SignedManifestEnvelope {
  const issuedAt = '2026-04-24T00:00:00.000Z';
  const payloadDigest = crypto
    .createHash('sha256')
    .update(canonicalizeJson(manifest))
    .digest('hex');
  const message = buildManifestSigningMessage({
    kid: 'key_test123',
    issuedAt,
    payloadDigest,
  });
  const secret = crypto
    .createHash('sha256')
    .update(`apex-manifest-signing:${apiKey}`)
    .digest();

  return {
    manifest,
    signature: {
      alg: 'HS256',
      kid: 'key_test123',
      issuedAt,
      expiresAt,
      payloadDigest,
      value: crypto.createHmac('sha256', secret).update(message).digest('hex'),
    },
  };
}

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    apiKey: 'apex_testkey123',
    serviceId: 'svc_test123',
    environment: 'test' as const,
    apexUrl: 'https://api.apex.nibblelayer.com',
    refreshIntervalMs: 60000,
    enableIdempotency: true,
    eventDelivery: 'fire-and-forget' as const,
    ...overrides,
  };
}

const MANIFEST_KEYS: (keyof ApexManifest)[] = [
  'serviceId',
  'environment',
  'version',
  'network',
  'facilitatorUrl',
  'wallet',
  'verifiedDomains',
  'routes',
  'eventsEndpoint',
  'idempotencyEnabled',
  'refreshIntervalMs',
  'checksum',
];

// ---------------------------------------------------------------------------
// a) Manifest contract is stable for both token types
// ---------------------------------------------------------------------------

describe('Gate 8: SDK boundary contract', () => {
  describe('a) Manifest contract is stable for both token types', () => {
    let manager: ManifestManager;

    afterEach(() => {
      manager?.stopAutoRefresh();
      vi.restoreAllMocks();
    });

    it('fetches manifest successfully with legacy apex_ token (unsigned mode)', async () => {
      const config = baseConfig({ apiKey: 'apex_legacykey999' });
      manager = new ManifestManager(config);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(mockManifest), { status: 200 }),
        ),
      );

      const result = await manager.fetchManifest();

      expect(result.serviceId).toBe(mockManifest.serviceId);
      expect(result.version).toBe(mockManifest.version);
      expect(result.routes).toEqual(mockManifest.routes);
      // Verify full shape parity with schema
      for (const key of MANIFEST_KEYS) {
        expect(result[key]).toEqual(mockManifest[key]);
      }
    });

    it('fetches manifest with signed verification using apx_sdk_ token', async () => {
      const apiKey = 'apx_sdk_scopedtoken456';
      const config = baseConfig({ apiKey });
      manager = new ManifestManager(config);
      const envelope = createSignedEnvelope(mockManifest, apiKey);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(envelope), { status: 200 }),
        ),
      );

      const result = await manager.fetchManifest();

      expect(result.serviceId).toBe(mockManifest.serviceId);
      expect(result.version).toBe(mockManifest.version);
      expect(result.routes).toEqual(mockManifest.routes);
      for (const key of MANIFEST_KEYS) {
        expect(result[key]).toEqual(mockManifest[key]);
      }
    });

    it('returns identical ApexManifest shape regardless of token type', async () => {
      // Legacy fetch
      const legacyConfig = baseConfig({ apiKey: 'apex_shape_test' });
      const legacyManager = new ManifestManager(legacyConfig);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify(mockManifest), { status: 200 }),
          ),
      );
      const legacyResult = await legacyManager.fetchManifest();

      // Signed fetch
      const sdkKey = 'apx_sdk_shape_test';
      const sdkConfig = baseConfig({ apiKey: sdkKey });
      const sdkManager = new ManifestManager(sdkConfig);
      const envelope = createSignedEnvelope(mockManifest, sdkKey);
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify(envelope), { status: 200 }),
          ),
      );
      const sdkResult = await sdkManager.fetchManifest();

      // Shape identity: same keys, same types, same values
      expect(Object.keys(legacyResult).sort()).toEqual(Object.keys(sdkResult).sort());
      expect(legacyResult).toEqual(sdkResult);

      legacyManager.stopAutoRefresh();
      sdkManager.stopAutoRefresh();
      vi.restoreAllMocks();
    });
  });

  // ---------------------------------------------------------------------------
  // b) SDK ignores unknown fields gracefully
  // ---------------------------------------------------------------------------

  describe('b) SDK ignores unknown fields gracefully', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('Zod schema strips unknown top-level fields from unsigned manifest', () => {
      const manifestWithExtras = {
        ...mockManifest,
        _internal_debug: true,
        _managed_feature_flag: 'enabled',
        unknownTopLevel: { foo: 'bar' },
      };

      const result = apexManifestSchema.safeParse(manifestWithExtras);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('_internal_debug');
        expect(result.data).not.toHaveProperty('_managed_feature_flag');
        expect(result.data).not.toHaveProperty('unknownTopLevel');
        // Known fields remain intact
        expect(result.data.serviceId).toBe(mockManifest.serviceId);
        expect(result.data.version).toBe(mockManifest.version);
      }
    });

    it('Zod schema strips unknown fields from signed envelope (strict mode)', () => {
      const sdkKey = 'apx_sdk_unknown_fields';
      const envelope = createSignedEnvelope(mockManifest, sdkKey);
      const envelopeWithExtras = {
        ...envelope,
        _extra_envelope_field: 'should_be_stripped',
      };

      const result = signedManifestEnvelopeSchema.safeParse(envelopeWithExtras);
      // strict() mode should reject unknown keys at envelope level
      expect(result.success).toBe(false);
    });

    it('SDK client parses manifest with extra fields without crashing', async () => {
      const config = baseConfig({ apiKey: 'apex_extra_fields' });
      const manager = new ManifestManager(config);
      const manifestWithExtras = {
        ...mockManifest,
        __internal__: { secret: 'nope' },
        deprecatedField: 'still here',
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(manifestWithExtras), { status: 200 }),
        ),
      );

      const result = await manager.fetchManifest();
      // ApexManifest shape should be clean
      expect(result.serviceId).toBe(mockManifest.serviceId);
      expect((result as Record<string, unknown>).__internal__).toBeUndefined();
      expect((result as Record<string, unknown>).deprecatedField).toBeUndefined();

      manager.stopAutoRefresh();
    });
  });

  // ---------------------------------------------------------------------------
  // c) SDK handles both OSS and hosted-style apexUrl
  // ---------------------------------------------------------------------------

  describe('c) SDK handles both OSS and hosted-style apexUrl', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('works with OSS self-hosted URL (http://localhost:3000)', async () => {
      const config = baseConfig({
        apiKey: 'apex_oss_local',
        apexUrl: 'http://localhost:3000',
      });
      const manager = new ManifestManager(config);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(mockManifest), { status: 200 }),
        ),
      );

      const result = await manager.fetchManifest();

      expect(result.serviceId).toBe(mockManifest.serviceId);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/services/svc_test123/manifest?env=test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer apex_oss_local',
          }),
        }),
      );

      manager.stopAutoRefresh();
    });

    it('works with hosted-style URL (https://api.apex.dev)', async () => {
      const config = baseConfig({
        apiKey: 'apex_hosted_test',
        apexUrl: 'https://api.apex.dev',
      });
      const manager = new ManifestManager(config);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(mockManifest), { status: 200 }),
        ),
      );

      const result = await manager.fetchManifest();

      expect(result.serviceId).toBe(mockManifest.serviceId);
      expect(fetch).toHaveBeenCalledWith(
        'https://api.apex.dev/services/svc_test123/manifest?env=test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer apex_hosted_test',
          }),
        }),
      );

      manager.stopAutoRefresh();
    });

    it('signed mode uses /sdk/manifest endpoint for both URL styles', async () => {
      const sdkKey = 'apx_sdk_url_test';

      // OSS style
      const ossConfig = baseConfig({ apiKey: sdkKey, apexUrl: 'http://localhost:3000' });
      const ossManager = new ManifestManager(ossConfig);
      const ossEnvelope = createSignedEnvelope(mockManifest, sdkKey);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(ossEnvelope), { status: 200 }),
        ),
      );
      await ossManager.fetchManifest();

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/sdk/manifest',
        expect.any(Object),
      );

      // Hosted style
      const hostedConfig = baseConfig({ apiKey: sdkKey, apexUrl: 'https://api.apex.dev' });
      const hostedManager = new ManifestManager(hostedConfig);
      const hostedEnvelope = createSignedEnvelope(mockManifest, sdkKey);
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify(hostedEnvelope), { status: 200 }),
        ),
      );
      await hostedManager.fetchManifest();

      expect(fetch).toHaveBeenCalledWith(
        'https://api.apex.dev/sdk/manifest',
        expect.any(Object),
      );

      ossManager.stopAutoRefresh();
      hostedManager.stopAutoRefresh();
    });
  });

  // ---------------------------------------------------------------------------
  // d) Contracts package doesn't export runtime secrets
  // ---------------------------------------------------------------------------

  describe('d) Contracts package exports only public types', () => {
    it('exports runtime schemas for ApexManifest, SignedManifestEnvelope, PaymentEvent', async () => {
      const contracts = await import('@nibblelayer/apex-contracts');

      // Runtime Zod schemas MUST be exported
      expect(contracts.apexManifestSchema).toBeDefined();
      expect(contracts.signedManifestEnvelopeSchema).toBeDefined();
      expect(contracts.paymentEventSchema).toBeDefined();
      expect(contracts.paymentEventTypeSchema).toBeDefined();
    });

    it('type-level exports include public types (compile-time gate)', async () => {
      // TypeScript types are erased at runtime, so we verify the module
      // re-exports match the expected public surface by checking the
      // barrel file contents for the correct type names.
      const indexContent = readFileSync(
        resolve(testDir, '../../contracts/src/index.ts'),
        'utf8',
      );
      const typesContent = readFileSync(
        resolve(testDir, '../../contracts/src/types/index.ts'),
        'utf8',
      );

      const combined = indexContent + typesContent;
      const publicTypes = [
        'ApexManifest',
        'SignedManifestEnvelope',
        'PaymentEvent',
        'PaymentEventType',
      ];
      for (const t of publicTypes) {
        expect(combined, `should export type ${t}`).toContain(t);
      }
    });

    it('does NOT export ApiKey, WebhookEndpoint types or schemas', async () => {
      const contracts = await import('@nibblelayer/apex-contracts');

      // These internal/managed types MUST NOT leak through contracts
      expect(contracts).not.toHaveProperty('ApiKey');
      expect(contracts).not.toHaveProperty('WebhookEndpoint');
      expect(contracts).not.toHaveProperty('apiKeySchema');
      expect(contracts).not.toHaveProperty('webhookEndpointSchema');
    });

    it('package.json has no database or runtime-secret dependencies', () => {
      const pkg = JSON.parse(
        readFileSync(resolve(testDir, '../../contracts/package.json'), 'utf8'),
      );

      expect(pkg.dependencies).not.toHaveProperty('pg');
      expect(pkg.dependencies).not.toHaveProperty('mysql2');
      expect(pkg.dependencies).not.toHaveProperty('mongodb');
      expect(pkg.dependencies).not.toHaveProperty('ioredis');
      // Contracts should only depend on zod
      expect(Object.keys(pkg.dependencies || {})).toEqual(['zod']);
    });
  });

  // ---------------------------------------------------------------------------
  // e) SDK has no managed-specific imports
  // ---------------------------------------------------------------------------

  describe('e) SDK has no managed-specific imports', () => {
    const forbiddenPatterns = [
      '@nibblelayer/apex-managed-api',
      '@nibblelayer/apex-managed-dashboard',
      '@nibblelayer/apex-managed-domain',
      '@nibblelayer/apex-managed-data',
      '@nibblelayer/apex-api',
      '@nibblelayer/apex-persistence',
      '@nibblelayer/apex-dashboard',
      '@nibblelayer/apex-core',
    ];

    it('dependencies contain no managed-specific or app-layer packages', () => {
      const pkg = JSON.parse(
        readFileSync(resolve(testDir, '../package.json'), 'utf8'),
      );

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.peerDependencies,
        ...pkg.devDependencies,
      };

      for (const forbidden of forbiddenPatterns) {
        expect(allDeps).not.toHaveProperty(forbidden);
      }
    });

    it('source files contain no managed-specific import paths', () => {
      const sourceFiles = ['src/index.ts', 'src/client.ts', 'src/manifest.ts', 'src/types.ts'];
      for (const file of sourceFiles) {
        const content = readFileSync(resolve(testDir, '..', file), 'utf8');
        for (const forbidden of forbiddenPatterns) {
          expect(
            content,
            `${file} should not import ${forbidden}`,
          ).not.toContain(forbidden);
        }
      }
    });
  });
});
