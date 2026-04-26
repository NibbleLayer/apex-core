import { describe, expect, it } from 'vitest';

import {
  buildCreateEnvironmentPayload,
  buildCreatePricePayload,
  buildCreateWalletPayload,
  buildDiscoveryPayload,
  slugifyServiceName,
} from '../api/payloads';

describe('dashboard payload helpers', () => {
  it('slugifies service names for generated service slugs', () => {
    expect(slugifyServiceName('Weather API v2')).toBe('weather-api-v2');
  });

  it('builds environment payloads with camelCase facilitatorUrl', () => {
    expect(
      buildCreateEnvironmentPayload({
        mode: 'prod',
        network: 'eip155:8453',
        facilitatorUrl: 'https://facilitator.example.com',
      }),
    ).toEqual({
      mode: 'prod',
      network: 'eip155:8453',
      facilitatorUrl: 'https://facilitator.example.com',
    });
  });

  it('requires and preserves environmentId, token, and network for wallet payloads', () => {
    expect(
      buildCreateWalletPayload({
        environmentId: 'env_123',
        token: '0x0000000000000000000000000000000000000001',
        network: 'eip155:84532',
      }),
    ).toMatchObject({
      environmentId: 'env_123',
      token: '0x0000000000000000000000000000000000000001',
      network: 'eip155:84532',
    });
  });

  it('rejects wallet payloads when required fields are missing', () => {
    expect(() =>
      buildCreateWalletPayload({
        environmentId: '',
        token: '0x0000000000000000000000000000000000000001',
        network: 'eip155:84532',
      }),
    ).toThrow(/environmentId/i);

    expect(() =>
      buildCreateWalletPayload({
        environmentId: 'env_123',
        token: '',
        network: 'eip155:84532',
      }),
    ).toThrow(/token/i);

    expect(() =>
      buildCreateWalletPayload({
        environmentId: 'env_123',
        token: '0x0000000000000000000000000000000000000001',
        network: '',
      }),
    ).toThrow(/network/i);
  });

  it("always emits scheme 'exact' for price payloads", () => {
    expect(
      buildCreatePricePayload({
        amount: '100',
        token: '0x0000000000000000000000000000000000000001',
        network: 'eip155:84532',
      }),
    ).toEqual({
      scheme: 'exact',
      amount: '100',
      token: '0x0000000000000000000000000000000000000001',
      network: 'eip155:84532',
    });
  });

  it('builds discovery payloads with camelCase keys and parsed schemas', () => {
    expect(
      buildDiscoveryPayload({
        discoverable: true,
        category: 'weather',
        tags: 'forecast, alerts',
        description: 'Weather alerts endpoint',
        mimeType: 'application/json',
        docsUrl: 'https://docs.example.com/weather',
        inputSchema: '{"type":"object","properties":{"city":{"type":"string"}}}',
        outputSchema: '{"type":"object","properties":{"temperature":{"type":"number"}}}',
        reviewStatus: 'published',
      }),
    ).toEqual({
      discoverable: true,
      category: 'weather',
      tags: ['forecast', 'alerts'],
      description: 'Weather alerts endpoint',
      mimeType: 'application/json',
      docsUrl: 'https://docs.example.com/weather',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        properties: {
          temperature: { type: 'number' },
        },
      },
      reviewStatus: 'published',
    });
  });

  it('throws clear errors for invalid input schema JSON', () => {
    expect(() =>
      buildDiscoveryPayload({
        discoverable: true,
        category: 'weather',
        tags: '',
        description: '',
        mimeType: 'application/json',
        docsUrl: 'https://docs.example.com/weather',
        inputSchema: '{not-json}',
        outputSchema: '{}',
        reviewStatus: 'draft',
      }),
    ).toThrow(/input schema/i);
  });

  it('throws clear errors for invalid output schema JSON', () => {
    expect(() =>
      buildDiscoveryPayload({
        discoverable: true,
        category: 'weather',
        tags: '',
        description: '',
        mimeType: 'application/json',
        docsUrl: 'https://docs.example.com/weather',
        inputSchema: '{}',
        outputSchema: '{not-json}',
        reviewStatus: 'draft',
      }),
    ).toThrow(/output schema/i);
  });
});
