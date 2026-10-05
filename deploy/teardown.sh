#!/usr/bin/env bash
# teardown.sh — empty the site bucket, then delete the whole stack. Asks first.
#   SSM demo-key parameters (set-secrets.sh) are NOT deleted; remove them separately if wanted.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
[[ -f "$here/deploy.env" ]] || { echo "missing deploy/deploy.env"; exit 1; }
# shellcheck disable=SC1091
source "$here/deploy.env"
export AWS_PROFILE AWS_REGION
acct="$(aws sts get-caller-identity --query Account --output text)"
[[ "$acct" == "$EXPECTED_ACCOUNT" ]] || { echo "refusing: wrong account"; exit 1; }
read -r -p "Delete stack '$STACK_NAME' in $AWS_REGION and empty its bucket? Type the stack name to confirm: " ans
[[ "$ans" == "$STACK_NAME" ]] || { echo "aborted"; exit 1; }
bucket="$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)"
[[ -n "$bucket" && "$bucket" != "None" ]] && aws s3 rm "s3://$bucket" --recursive --only-show-errors
aws cloudformation delete-stack --stack-name "$STACK_NAME"
aws cloudformation wait stack-delete-complete --stack-name "$STACK_NAME"
echo "deleted $STACK_NAME"
