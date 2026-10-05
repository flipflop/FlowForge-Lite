#!/usr/bin/env bash
# set-secrets.sh — store the OPTIONAL server demo keys in SSM Parameter Store (SecureString).
#
#   ./deploy/set-secrets.sh
#
# Prompts with no echo; press Enter to skip a key. Values are never printed or placed in the
# template, the Lambda environment or the process list. The API reads them once per container.
# Without them, visitors must supply their own keys under "API Keys".
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$here/deploy.env" ]] || { echo "missing deploy/deploy.env"; exit 1; }
# shellcheck disable=SC1091
source "$here/deploy.env"
export AWS_PROFILE AWS_REGION
prefix="${SSM_PREFIX:-/flowforge-lite/prod}"; prefix="${prefix%/}"

acct="$(aws sts get-caller-identity --query Account --output text)"
[[ "$acct" == "$EXPECTED_ACCOUNT" ]] || { echo "refusing: wrong account"; exit 1; }
echo "Writing under $prefix (account OK, region $AWS_REGION)"

put() { # name label
  local value
  read -r -s -p "$2 (Enter to skip): " value; echo
  [[ -z "$value" ]] && { echo "  skipped $1"; return; }
  # The value goes through a temp file so it never appears in argv.
  local tmp; tmp="$(mktemp)"; chmod 600 "$tmp"; trap 'rm -f "$tmp"' RETURN
  printf '%s' "$value" > "$tmp"
  aws ssm put-parameter --name "$prefix/$1" --type SecureString --overwrite \
    --value "file://$tmp" >/dev/null
  echo "  stored $prefix/$1"
}
put gemini-api-key "Gemini API key"
put anthropic-api-key "Anthropic API key"
echo "Done. Running containers pick the new values up on their next cold start."
