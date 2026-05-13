#!/usr/bin/env bash
# ============================================================================
# verify-publish-state.sh
#
# Verifies that published npm packages have their version bumped when their
# source code changes. Must pass before merging to main.
#
# Published packages:
#   @nibblelayer/apex-contracts       → packages/contracts
#   @nibblelayer/apex-control-plane-core → packages/control-plane-core
#   @nibblelayer/apex-hono            → packages/sdk-hono
#   @nibblelayer/apex-network         → packages/network
#   @nibblelayer/apex-network-evm     → packages/network-evm
#
# Usage:
#   bash scripts/verify-publish-state.sh             # check all packages
#   bash scripts/verify-publish-state.sh --strict     # fail on warnings too
#   bash scripts/verify-publish-state.sh --changed-only # only check changed
# ============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STRICT_MODE=false
CHANGED_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT_MODE=true ;;
    --changed-only) CHANGED_ONLY=true ;;
  esac
done

# Published packages: name → directory
declare -A PUBLISHED=(
  ["@nibblelayer/apex-contracts"]="packages/contracts"
  ["@nibblelayer/apex-control-plane-core"]="packages/control-plane-core"
  ["@nibblelayer/apex-hono"]="packages/sdk-hono"
  ["@nibblelayer/apex-network"]="packages/network"
  ["@nibblelayer/apex-network-evm"]="packages/network-evm"
)

errors=0
warnings=0

# Determine base ref for comparison
# Prefer CI base ref, then origin/main, then HEAD~1 as fallback
BASE_REF="${GITHUB_BASE_REF:-}"
if [[ -z "$BASE_REF" ]]; then
  if git rev-parse origin/main >/dev/null 2>&1; then
    BASE_REF="origin/main"
  else
    BASE_REF="HEAD~1"
  fi
fi

echo "==> Apex publish state verification"
echo "    Base ref: $BASE_REF"
echo ""

for pkg_name in "${!PUBLISHED[@]}"; do
  pkg_dir="${PUBLISHED[$pkg_name]}"

  if [[ ! -d "$pkg_dir" ]]; then
    echo -e "  ${RED}✗${NC} $pkg_name — directory '$pkg_dir' not found"
    ((errors++)) || true
    continue
  fi

  # Check if the package has changed compared to base
  changed_files=$(git diff --name-only "$BASE_REF" -- "$pkg_dir/" 2>/dev/null || echo "")

  # If no changes and we only check changed packages, skip
  if [[ -z "$changed_files" ]]; then
    if $CHANGED_ONLY; then
      continue
    fi
    echo -e "  ${GREEN}✓${NC} $pkg_name — no changes detected"
    continue
  fi

  # Package has changes — read its current version
  pkg_json="${pkg_dir}/package.json"
  if [[ ! -f "$pkg_json" ]]; then
    echo -e "  ${RED}✗${NC} $pkg_name — package.json not found"
    ((errors++)) || true
    continue
  fi

  current_version=$(node -e "console.log(require('${pkg_json}').version)" 2>/dev/null || echo "unknown")

  # Check if version was bumped in this branch
  version_changed=$(git diff "$BASE_REF" -- "$pkg_json" 2>/dev/null | grep -c '"version"' || true)

  # Count changed source files (exclude package.json, lock files, tests)
  src_changes=$(echo "$changed_files" | grep -c -E '\.(ts|js|json)$' || true)

  if [[ "$version_changed" -gt 0 ]]; then
    echo -e "  ${GREEN}✓${NC} $pkg_name@${current_version} — version bumped (${src_changes} source file(s) changed)"
  else
    if [[ "$src_changes" -gt 0 ]]; then
      echo -e "  ${YELLOW}⚠${NC} $pkg_name@${current_version} — ${src_changes} source file(s) changed but version NOT bumped"
      if $STRICT_MODE; then
        ((errors++)) || true
      else
        ((warnings++)) || true
      fi
    else
      # Only non-source files changed (e.g. README, tests)
      echo -e "  ${GREEN}✓${NC} $pkg_name@${current_version} — only non-source changes, no bump needed"
    fi
  fi
done

echo ""

if [[ "$errors" -gt 0 ]]; then
  echo -e "${RED}✗ Verification failed — $errors error(s), $warnings warning(s)${NC}"
  echo ""
  echo "  Published packages with source changes must have their version bumped."
  echo "  Run: cd packages/<pkg> && npm version patch (or minor/major)"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  echo -e "${YELLOW}⚠ Verification passed with $warnings warning(s)${NC}"
  echo ""
  echo "  Consider bumping versions for the packages listed above."
  echo "  Run with --strict to enforce version bumps for all changes."
fi

echo -e "${GREEN}✓ All published packages verified${NC}"
exit 0
