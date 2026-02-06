#!/bin/bash
set -euo pipefail

echo "Building Lambda bundles..."
pnpm build:lambda

echo "Deploying to LocalStack..."
cd infra/env/prod

export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=ap-southeast-1
export AWS_ENDPOINT_URL=http://localhost:4566
export LOCALSTACK=1
export TG_TFPATH=tflocal
export TF_VAR_slack_bot_token="${SLACK_BOT_TOKEN:-xoxb-test}"
export TF_VAR_slack_signing_secret="${SLACK_SIGNING_SECRET:-test-signing-secret}"
export TF_VAR_superadmin_user_id="${SUPERADMIN_USER_ID:-U_ADMIN}"
export TF_VAR_create_db_subnet_group=false
export TF_VAR_database_url="postgresql://standup:standup@localhost:5432/standup"

# Deploy units in dependency order, skipping rds and api-gateway (LocalStack Pro)
for unit in vpc security-groups lambda eventbridge; do
  echo "Applying ${unit}..."
  pushd "${unit}" > /dev/null
  terragrunt apply --non-interactive --backend-bootstrap
  popd > /dev/null
done

echo "Deployment complete!"
echo "Invoke Lambda directly:"
echo "  awslocal --region ap-southeast-1 lambda invoke --function-name tfx-slack-bot-slack-handler --payload '{}' /dev/stdout"
