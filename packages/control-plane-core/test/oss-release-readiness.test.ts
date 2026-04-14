import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type PackageManifest = {
  name?: string;
  version?: string;
  type?: string;
  exports?: Record<string, unknown>;
  files?: string[];
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const testDir = dirname(fileURLToPath(import.meta.url));

const readPackageJson = (relativePath: string): PackageManifest => {
  const packageJsonPath = resolve(testDir, relativePath);
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageManifest;
};

const contractsPackage = readPackageJson('../../contracts/package.json');
const controlPlaneCorePackage = readPackageJson('../package.json');
const honoPackage = readPackageJson('../../sdk-hono/package.json');

const expectReleaseMetadata = (
  packageJson: PackageManifest,
  expectedName: string,
) => {
  expect(packageJson.name).toBe(expectedName);
  expect(packageJson.version).toBeTruthy();
  expect(packageJson.type).toBe('module');
  expect(packageJson.exports).toBeDefined();
  expect(Object.keys(packageJson.exports ?? {})).not.toHaveLength(0);
  expect(packageJson.files).toContain('dist');
};

describe('OSS release readiness', () => {
  it('keeps the release-set packages publishable with required metadata', () => {
    expectReleaseMetadata(contractsPackage, '@nibblelayer/apex-contracts');
    expectReleaseMetadata(controlPlaneCorePackage, '@nibblelayer/apex-control-plane-core');
    expectReleaseMetadata(honoPackage, '@nibblelayer/apex-hono');
  });

  it('keeps @nibblelayer/apex-contracts free of database exports', () => {
    expect(contractsPackage.exports).not.toHaveProperty('./db');
  });

  it('keeps @nibblelayer/apex-control-plane-core limited to OSS-safe dependencies', () => {
    expect(controlPlaneCorePackage.dependencies).toEqual({
      '@nibblelayer/apex-contracts': 'workspace:*',
    });

    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-core');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-persistence');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-api');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-dashboard');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-hono');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-api');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-dashboard');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-domain');
    expect(controlPlaneCorePackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-data');
  });

  it('keeps @nibblelayer/apex-hono free of managed-only and app-layer dependencies', () => {
    expect(honoPackage.dependencies).toMatchObject({
      '@nibblelayer/apex-contracts': 'workspace:*',
    });

    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-control-plane-core');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-core');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-persistence');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-api');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-dashboard');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-api');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-dashboard');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-domain');
    expect(honoPackage.dependencies).not.toHaveProperty('@nibblelayer/apex-managed-data');
    expect(honoPackage.peerDependencies).not.toHaveProperty('@nibblelayer/apex-managed-api');
    expect(honoPackage.peerDependencies).not.toHaveProperty('@nibblelayer/apex-managed-dashboard');
    expect(honoPackage.peerDependencies).not.toHaveProperty('@nibblelayer/apex-managed-domain');
    expect(honoPackage.peerDependencies).not.toHaveProperty('@nibblelayer/apex-managed-data');
  });
});
