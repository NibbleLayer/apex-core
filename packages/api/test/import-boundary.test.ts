import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(testDir, '../src');

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return ['.ts', '.tsx', '.js', '.jsx'].includes(extname(fullPath)) ? [fullPath] : [];
  });
}

describe('@nibblelayer/apex-api OSS import boundary', () => {
  it('only imports @nibblelayer/apex-persistence through the db entrypoint', () => {
    const violatingFiles = collectSourceFiles(srcDir).flatMap((filePath) => {
      const contents = readFileSync(filePath, 'utf8');
      const legacyImports = contents.match(/@nibblelayer\/apex-core(?:\/[^'"\n]*)?/g) ?? [];
      const persistenceImports = contents.match(/@nibblelayer\/apex-persistence(?!\/db\b)[^'"\n]*/g) ?? [];

      return legacyImports.length > 0 || persistenceImports.length > 0 ? [filePath] : [];
    });

    expect(violatingFiles).toEqual([]);
  });
});
