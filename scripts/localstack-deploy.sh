#!/bin/bash
set -euo pipefail

echo "Building Lambda bundles..."
pnpm build:lambda

echo "Deploying to LocalStack..."
cd infra/env/prod

TERRAGRUNT_TFPATH=tflocal \
  TF_VAR_slack_bot_token="${SLACK_BOT_TOKEN:-xoxb-test}" \
  TF_VAR_slack_signing_secret="${SLACK_SIGNING_SECRET:-test-signing-secret}" \
  TF_VAR_superadmin_user_id="${SUPERADMIN_USER_ID:-U_ADMIN}" \
  terragrunt run-all apply --terragrunt-non-interactive

echo "Deployment complete!"
echo "API Gateway endpoint: http://localhost:4566/restapis"
