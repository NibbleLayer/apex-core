import { describe, expect, it } from 'vitest';
import { buildDiscoveryPreview, validateDiscoveryQuality } from '../../src/services/discovery-quality.js';

describe('discovery quality helpers', () => {
  it('returns publishing errors and discoverability warnings for incomplete metadata', () => {
    const checks = validateDiscoveryQuality({ discoverable: false, description: 'Short' });

    expect(checks.filter((check) => check.level === 'error').map((check) => check.message)).toEqual(
      expect.arrayContaining([
        'Category is required before publishing.',
        'MIME type is required before publishing.',
        'Input schema is required before publishing.',
        'Output schema is required before publishing.',
        'Route must be discoverable before publishing.',
      ]),
    );
    expect(checks.some((check) => check.level === 'warning' && check.message.includes('Description is short'))).toBe(true);
  });

  it('builds a stable Bazaar listing preview', () => {
    const preview = buildDiscoveryPreview({
      route: { method: 'GET', path: '/weather', description: 'Route fallback' },
      metadata: {
        discoverable: true,
        category: 'weather',
        tags: ['forecast'],
        description: 'Detailed weather forecast endpoint',
        mimeType: 'application/json',
        docsUrl: 'https://docs.example.com/weather',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        reviewStatus: 'published',
        indexingStatus: 'queued',
        published: true,
      },
    });

    expect(preview).toMatchObject({
      method: 'GET',
      path: '/weather',
      title: 'weather',
      summary: 'Detailed weather forecast endpoint',
      status: { reviewStatus: 'published', indexingStatus: 'queued', published: true },
    });
  });
});
