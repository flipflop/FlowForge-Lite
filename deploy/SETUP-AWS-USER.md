# One-time: a scoped deploy user for FlowForge Lite

The stack creates an IAM role for the Lambda function, so the deploying identity needs IAM
permissions. Rather than widening a general-purpose user, give FlowForge Lite its own IAM user
whose policy only reaches resources named `flowforge-lite*` (stack, bucket, function, role,
log group, SSM parameters) plus CloudFront, which has no per-resource scoping for creation.
Do this once, signed in to the AWS console as an administrator.

1. **IAM → Policies → Create policy → JSON.** Paste [`deployer-policy.json`](deployer-policy.json).
   Name it `flowforge-lite-deployer`. (It is about 5 KB, so it must be a managed policy, not inline.)
2. **IAM → Users → Create user** `flowforge-lite-deployer`, no console access.
   **Attach policies directly** → `flowforge-lite-deployer`.
3. **The user → Security credentials → Create access key → Command Line Interface.**
4. Locally: `aws configure --profile flowforge-lite` (paste the key, region `ap-southeast-2`),
   then `aws sts get-caller-identity --profile flowforge-lite`.
5. In `deploy/deploy.env` set `AWS_PROFILE=flowforge-lite`.

ARNs in the policy use `*` for the account id so the file can live in a public repo; IAM
evaluates them only within the account the user belongs to.

## Recovering a failed first deploy

If a stack ends in `ROLLBACK_FAILED` or `ROLLBACK_COMPLETE`, CloudFormation will not update
it; delete it with the deploy profile, then deploy again:

```bash
aws cloudformation delete-stack --stack-name flowforge-lite --profile flowforge-lite --region ap-southeast-2
aws cloudformation wait stack-delete-complete --stack-name flowforge-lite --profile flowforge-lite --region ap-southeast-2
./deploy/deploy.sh
```
