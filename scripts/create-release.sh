#!/usr/bin/env bash
set -euo pipefail

release_name="${1:-payflow-release-$(git rev-parse --short HEAD).zip}"

tracked_secrets="$(git ls-files | while IFS= read -r file; do
  case "$file" in
    .env|*/.env|.env.local|*/.env.local) printf '%s\n' "$file" ;;
  esac
done)"
if [[ -n "$tracked_secrets" ]]; then
  echo "Refusing to archive tracked environment files:" >&2
  echo "$tracked_secrets" >&2
  exit 1
fi

git archive --format=zip --output="$release_name" HEAD

if unzip -Z1 "$release_name" |
  grep -Eq '(^|/)\.env(\.local)?$|(^|/)(\.git|node_modules|dist)/'; then
  echo "Unsafe release entry detected" >&2
  exit 1
fi

echo "Created safe release archive: $release_name"
