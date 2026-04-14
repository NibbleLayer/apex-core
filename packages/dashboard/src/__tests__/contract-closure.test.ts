import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(testDir, '..');

function readSource(relativePath: string): string {
  return readFileSync(path.join(srcDir, relativePath), 'utf8');
}

describe('SPEC-OSS-0003-P0 contract closure regressions', () => {
  it('WalletManager includes environmentId and token in the create wallet request', () => {
    const source = readSource('components/WalletManager.tsx');

    expect(source).toMatch(/api\.createWallet\(props\.serviceId,\s*\{[\s\S]*environmentId:/);
    expect(source).toMatch(/api\.createWallet\(props\.serviceId,\s*\{[\s\S]*token:/);
  });

  it('PriceEditor no longer offers fixed or dynamic price scheme values', () => {
    const source = readSource('components/PriceEditor.tsx');

    expect(source).not.toMatch(/<option\s+value="fixed">/);
    expect(source).not.toMatch(/<option\s+value="dynamic">/);
  });

  it('DiscoveryEditor stops sending snake_case discovery request keys', () => {
    const source = readSource('components/DiscoveryEditor.tsx');

    expect(source).not.toContain('mime_type:');
    expect(source).not.toContain('docs_url:');
    expect(source).not.toContain('input_schema:');
    expect(source).not.toContain('output_schema:');
  });

  it('ServiceDetail exposes a real environment creation path', () => {
    const source = readSource('pages/ServiceDetail.tsx');

    expect(source).toMatch(/api\.createEnvironment|<\s*(EnvironmentManager|EnvironmentEditor|CreateEnvironmentForm)\b/);
  });

  it('Services no longer sends slug: newSlug() || undefined', () => {
    const source = readSource('pages/Services.tsx');

    expect(source).not.toContain('slug: newSlug() || undefined');
  });
});
