import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(testDir, '../package.json');

describe('@nibblelayer/apex-persistence package boundary', () => {
  it('exports only the database entrypoint', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      exports: Record<string, unknown>;
    };

    expect(Object.keys(packageJson.exports)).toEqual(['./db']);
  });

  it('stays free of transport or manifest-layer dependencies', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      dependencies: Record<string, string>;
    };

    expect(packageJson.dependencies).toEqual({
      'drizzle-orm': '^0.44.0',
    });
  });
});
