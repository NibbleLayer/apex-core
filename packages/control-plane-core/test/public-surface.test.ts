import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as controlPlaneCore from '../src/index.js';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(testDir, '../package.json');

describe('@nibblelayer/apex-control-plane-core public surface', () => {
  it('exports only transport-neutral manifest helpers', () => {
    expect(controlPlaneCore.buildManifest).toBeDefined();
    expect(controlPlaneCore.computeChecksum).toBeDefined();
    expect(controlPlaneCore.hasManifestChanged).toBeDefined();
    expect(controlPlaneCore).not.toHaveProperty('db');
    expect(controlPlaneCore).not.toHaveProperty('hono');
    expect(controlPlaneCore).not.toHaveProperty('drizzle');
    expect(controlPlaneCore).not.toHaveProperty('dashboard');
  });

  it('defines only a root package export', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports)).toEqual(['.']);
  });
});
