#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"

export ROOT_DIR

node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.env.ROOT_DIR;
const colors = {
  blue: '\u001b[1;34m',
  green: '\u001b[0;32m',
  yellow: '\u001b[1;33m',
  red: '\u001b[0;31m',
  reset: '\u001b[0m',
};

const publicPackages = [
  { name: '@nibblelayer/apex-contracts', relativePath: 'packages/contracts/package.json' },
  { name: '@nibblelayer/apex-control-plane-core', relativePath: 'packages/control-plane-core/package.json' },
  { name: '@nibblelayer/apex-hono', relativePath: 'packages/sdk-hono/package.json' },
];

const internalPackages = [
  { name: '@nibblelayer/apex-persistence', relativePath: 'packages/core/package.json' },
  { name: '@nibblelayer/apex-api', relativePath: 'packages/api/package.json' },
  { name: '@nibblelayer/apex-dashboard', relativePath: 'packages/dashboard/package.json' },
];

let errorCount = 0;

function log(message) {
  console.log(message);
}

function pass(message) {
  log(`${colors.green}PASS:${colors.reset} ${message}`);
}

function info(message) {
  log(`${colors.blue}INFO:${colors.reset} ${message}`);
}

function warn(message) {
  log(`${colors.yellow}CHECK:${colors.reset} ${message}`);
}

function error(message) {
  errorCount += 1;
  log(`${colors.red}ERROR:${colors.reset} ${message}`);
}

function absolute(relativePath) {
  return path.join(rootDir, relativePath);
}

function readPackage(packageSpec) {
  const filePath = absolute(packageSpec.relativePath);
  if (!fs.existsSync(filePath)) {
    error(`${packageSpec.name} package.json not found at ${packageSpec.relativePath}.`);
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    pass(`${packageSpec.name} exists at ${packageSpec.relativePath}.`);
    return parsed;
  } catch (cause) {
    error(`${packageSpec.name} package.json is not valid JSON: ${cause.message}`);
    return undefined;
  }
}

function checkPackageName(packageSpec, pkg) {
  if (pkg.name === packageSpec.name) {
    pass(`${packageSpec.name} package name matches expected boundary.`);
  } else {
    error(`${packageSpec.relativePath} has name '${pkg.name}', expected '${packageSpec.name}'.`);
  }
}

log(`${colors.blue}=== Apex release metadata verification ===${colors.reset}`);
info(`Workspace: ${rootDir}`);

const publicVersions = new Map();

for (const packageSpec of publicPackages) {
  warn(`Verifying public package ${packageSpec.name}`);
  const pkg = readPackage(packageSpec);
  if (!pkg) continue;

  checkPackageName(packageSpec, pkg);

  if (pkg.private !== true) {
    pass(`${packageSpec.name} is publishable (private is not true).`);
  } else {
    error(`${packageSpec.name} must not set private: true.`);
  }

  if (pkg.publishConfig?.access === 'public') {
    pass(`${packageSpec.name} publishConfig.access is public.`);
  } else {
    error(`${packageSpec.name} must set publishConfig.access to 'public'.`);
  }

  if (pkg.license === 'Apache-2.0') {
    pass(`${packageSpec.name} license is Apache-2.0.`);
  } else {
    error(`${packageSpec.name} must use license 'Apache-2.0'.`);
  }

  if (Array.isArray(pkg.files) && pkg.files.includes('dist') && pkg.files.includes('README.md')) {
    pass(`${packageSpec.name} files includes dist and README.md.`);
  } else {
    error(`${packageSpec.name} files must include 'dist' and 'README.md'.`);
  }

  if (typeof pkg.version === 'string' && pkg.version.length > 0) {
    publicVersions.set(packageSpec.name, pkg.version);
    pass(`${packageSpec.name} version is ${pkg.version}.`);
  } else {
    error(`${packageSpec.name} must define a non-empty version.`);
  }
}

const uniqueVersions = new Set(publicVersions.values());
if (uniqueVersions.size === 1) {
  pass(`Public package versions match: ${[...uniqueVersions][0]}.`);
} else {
  error(`Public package versions must match; observed ${JSON.stringify(Object.fromEntries(publicVersions))}.`);
}

for (const packageSpec of internalPackages) {
  warn(`Verifying internal package ${packageSpec.name}`);
  const pkg = readPackage(packageSpec);
  if (!pkg) continue;

  checkPackageName(packageSpec, pkg);

  if (pkg.private === true) {
    pass(`${packageSpec.name} is private.`);
  } else {
    error(`${packageSpec.name} must set private: true.`);
  }

  if (pkg.publishConfig?.access !== 'public') {
    pass(`${packageSpec.name} does not declare public publish access.`);
  } else {
    error(`${packageSpec.name} must not set publishConfig.access to 'public'.`);
  }
}

const changelogPath = absolute('CHANGELOG.md');
if (!fs.existsSync(changelogPath)) {
  error('CHANGELOG.md not found.');
} else {
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const releaseHeading = changelog.split(/\r?\n/).find((line) => /^## \[[0-9]+\.[0-9]+\.[0-9]+\]/.test(line));
  if (!releaseHeading) {
    error('CHANGELOG.md does not contain a top release heading like ## [x.y.z].');
  } else {
    const changelogVersion = releaseHeading.match(/^## \[([^\]]+)\]/)?.[1];
    const publicVersion = [...uniqueVersions][0];
    if (uniqueVersions.size === 1 && changelogVersion === publicVersion) {
      pass(`Top changelog release ${changelogVersion} matches public package version train.`);
    } else {
      error(`Top changelog release ${changelogVersion} must match public package version train ${publicVersion ?? 'unknown'}.`);
    }
  }
}

if (fs.existsSync(absolute('docs/RELEASE_PROCESS.md'))) {
  pass('docs/RELEASE_PROCESS.md exists.');
} else {
  error('docs/RELEASE_PROCESS.md not found.');
}

if (errorCount > 0) {
  log(`${colors.red}Release metadata verification failed with ${errorCount} error(s).${colors.reset}`);
  process.exit(1);
}

log(`${colors.green}Release metadata verification completed successfully.${colors.reset}`);
NODE
