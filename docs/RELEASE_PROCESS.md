# Release Process

This document defines the manual, auditable release process for Apex Core.

## Package publication matrix

### Public packages

| Package | Publication status | Access |
| --- | --- | --- |
| `@nibblelayer/apex-contracts` | Publishable public package | `public` |
| `@nibblelayer/apex-control-plane-core` | Publishable public package | `public` |
| `@nibblelayer/apex-hono` | Publishable public package | `public` |

### Internal packages

| Package | Publication status |
| --- | --- |
| `@nibblelayer/apex-persistence` | Internal/private; never published |
| `@nibblelayer/apex-api` | Internal/private; never published |
| `@nibblelayer/apex-dashboard` | Internal/private; never published |

## Versioning rules

- Public packages follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
- Public package versions move together for now. The current train is `0.1.0`.
- Do not bump one public package alone without documenting why in the release preparation evidence and release notes.
- The top release entry in `CHANGELOG.md` must match the public package version train.
- Package version changes are allowed only in release-prep commits.

## Changelog rules

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
- The latest release heading must use `## [x.y.z] - YYYY-MM-DD`.
- The top release version must match all public package versions.
- Release notes should group changes under standard sections such as `Added`, `Changed`, `Fixed`, `Deprecated`, `Removed`, and `Security`.
- Internal package changes may be listed when they affect the self-hosted release, but they do not imply npm publication.

## Release verification workflow

Run the verification commands before publishing:

```bash
pnpm release:verify
pnpm pack:verify
pnpm compose:verify
pnpm release:metadata
```

`pnpm release:metadata` runs `scripts/verify-release-metadata.sh` and verifies package publication boundaries, public package metadata, synchronized public versions, changelog alignment, and this release process document.

## Manual publish workflow

Publishing is manual and auditable. Automatic publish is intentionally disabled until reviewed.

1. Create a release-prep commit that contains only intended version, changelog, release documentation, and release metadata changes.
2. Build the workspace:

   ```bash
   pnpm build
   ```

3. Run release verification:

   ```bash
   pnpm release:verify
   pnpm pack:verify
   pnpm compose:verify
   pnpm release:metadata
   ```

4. Inspect generated public package tarballs before publication.
5. Create the release tag for the public version train, for example `v0.1.0`.
6. Publish public packages only:

   ```bash
   pnpm --filter @nibblelayer/apex-contracts publish
   pnpm --filter @nibblelayer/apex-control-plane-core publish
   pnpm --filter @nibblelayer/apex-hono publish
   ```

7. Create GitHub release notes from `CHANGELOG.md` for the tagged version.
8. Record AIWF evidence with verification command output, inspected tarballs, tag, published package versions, and release notes link.

## Non-goals

- Internal packages are never published.
- No npm token is stored in this repository.
- No automatic npm publish workflow exists until it has been explicitly reviewed and approved.
