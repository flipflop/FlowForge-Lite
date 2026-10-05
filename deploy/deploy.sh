#!/usr/bin/env bash
# deploy.sh — build the API bundle, deploy the SAM stack, publish web/.
#
#   ./deploy/deploy.sh                 build + stack + sync + invalidate
#   ./deploy/deploy.sh --static-only   skip build and stack (content change only)
#   ./deploy/deploy.sh --build-only    only build deploy/.build/api (no AWS calls)
#
# Reads deploy/deploy.env (gitignored; see deploy.env.example). Refuses to run unless the
# caller identity matches EXPECTED_ACCOUNT, so a wrong profile can never publish elsewhere.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
mode="${1:-full}"
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

build_api() {
  say "build api bundle"
  local out="$here/.build/api"
  rm -rf "$out"; mkdir -p "$out"
  # python-dotenv is local-dev only (main.py guards the import); boto3 is in the Lambda runtime.
  grep -v -i '^python-dotenv' "$root/backend/requirements.txt" > "$here/.build/requirements.lambda.txt"
  # Isolated venv: pip --target still checks the caller's global site-packages and prints
  # unrelated conflict warnings; a clean venv has nothing to conflict with.
  local venv="$here/.build/venv"
  [[ -x "$venv/bin/pip" ]] || python3 -m venv "$venv"
  "$venv/bin/pip" install -q --disable-pip-version-check -r "$here/.build/requirements.lambda.txt" \
    --platform manylinux2014_aarch64 --implementation cp --python-version 3.12 \
    --only-binary=:all: --target "$out"
  cp "$root"/backend/*.py "$out/"
  cp "$root/backend/lambda/run.sh" "$out/run.sh"; chmod +x "$out/run.sh"
  find "$out" -name __pycache__ -type d -prune -exec rm -rf {} +
  echo "bundle: $(du -sh "$out" | cut -f1) at deploy/.build/api"
}

if [[ "$mode" == "--build-only" ]]; then build_api; exit 0; fi

[[ -f "$here/deploy.env" ]] || { echo "missing deploy/deploy.env (copy deploy.env.example)"; exit 1; }
# shellcheck disable=SC1091
source "$here/deploy.env"
export AWS_PROFILE AWS_REGION

say "identity check"
acct="$(aws sts get-caller-identity --query Account --output text)"
[[ "$acct" == "$EXPECTED_ACCOUNT" ]] || { echo "refusing: profile $AWS_PROFILE is account $acct, expected $EXPECTED_ACCOUNT"; exit 1; }
echo "account OK, region $AWS_REGION, stack $STACK_NAME"

say "tests"
node --test "$root"/web/tests/*.test.mjs >/dev/null && echo "web: pass"
(cd "$root/backend" && python3 -m pytest -q 2>&1 | tail -1) || true

if [[ "$mode" != "--static-only" ]]; then
  # Shared secret between CloudFront and the API. Generated once, then kept in deploy.env.
  if [[ -z "${ORIGIN_VERIFY_SECRET:-}" ]]; then
    ORIGIN_VERIFY_SECRET="$(openssl rand -hex 24)"
    printf '\nORIGIN_VERIFY_SECRET=%s\n' "$ORIGIN_VERIFY_SECRET" >> "$here/deploy.env"
    echo "generated ORIGIN_VERIFY_SECRET (saved to deploy/deploy.env)"
  fi
  status="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].StackStatus" --output text 2>/dev/null || true)"
  case "$status" in
    ROLLBACK_COMPLETE|ROLLBACK_FAILED|DELETE_FAILED)
      echo "stack $STACK_NAME is $status and cannot be updated; delete it first (deploy/SETUP-AWS-USER.md, 'Recovering a failed first deploy')"
      exit 1 ;;
  esac
  build_api

  say "sam deploy"
  # sam rejects empty values (`HostName=`), so optional parameters are added only when set.
  optional=()
  [[ -n "${HOST_NAME:-}" ]] && optional+=("HostName=$HOST_NAME")
  [[ -n "${CERTIFICATE_ARN:-}" ]] && optional+=("CertificateArn=$CERTIFICATE_ARN")
  # Each override is its own argv element, so the secret needs no shell quoting. It is hex only.
  sam deploy --template-file "$here/template.yaml" --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" --resolve-s3 --capabilities CAPABILITY_IAM \
    --no-fail-on-empty-changeset --no-confirm-changeset --tags "project=$STACK_NAME" \
    --parameter-overrides \
      "OriginVerifySecret=$ORIGIN_VERIFY_SECRET" \
      "SsmPrefix=${SSM_PREFIX:-/flowforge-lite/prod}" \
      "ReservedConcurrency=${RESERVED_CONCURRENCY:-5}" \
      "RunsPerHour=${RUNS_PER_HOUR:-10}" \
      ${optional[@]+"${optional[@]}"}
fi

out() { aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
bucket="$(out BucketName)"; dist="$(out DistributionId)"; url="$(out SiteUrl)"

say "sync web/ -> s3"
common=(--delete --exclude "*.DS_Store" --exclude "dev/*" --exclude "tests/*" --exclude "*.md")
# Fonts never change under the same name: cache for a year.
aws s3 sync "$root/web/fonts" "s3://$bucket/fonts" --delete --exclude "*.DS_Store" \
  --cache-control "public, max-age=31536000, immutable"
# ES modules are imported without version tags, so keep CSS/JS short-lived.
aws s3 sync "$root/web" "s3://$bucket" "${common[@]}" --exclude "fonts/*" --exclude "*.html" \
  --cache-control "public, max-age=300"
aws s3 sync "$root/web" "s3://$bucket" "${common[@]}" --exclude "*" --include "*.html" --exclude "dev/*" \
  --cache-control "no-cache" --content-type "text/html; charset=utf-8"

say "invalidate"
aws cloudfront create-invalidation --distribution-id "$dist" --paths "/*" --query Invalidation.Id --output text

say "smoke test $url/health"
sleep 5
curl -fsS --max-time 30 "$url/health" && echo || echo "(not ready yet; CloudFront can take a few minutes to propagate. Retry the curl.)"

say "live at $url"
