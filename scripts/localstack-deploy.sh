#!/bin/bash
set -euo pipefail

# Load environment variables from .env if it exists
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

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
export TF_VAR_database_url="${DATABASE_URL}"

# Deploy units in dependency order, skipping rds and api-gateway (LocalStack Pro)
for unit in vpc security-groups lambda eventbridge; do
  echo "Applying ${unit}..."
  pushd "${unit}" > /dev/null
  terragrunt apply --non-interactive --backend-bootstrap --auto-approve
  popd > /dev/null
done

echo ""
echo "Deployment complete!"
echo ""

# Get function URL directly from LocalStack
FUNCTION_URL=$(awslocal --region ap-southeast-1 lambda get-function-url-config \
  --function-name tfx-slack-bot-slack-handler \
  --query 'FunctionUrl' --output text 2>/dev/null || true)

if [ -n "$FUNCTION_URL" ] && [ "$FUNCTION_URL" != "None" ]; then
  # Extract host from function URL (remove http:// prefix and trailing /)
  FUNCTION_HOST=$(echo "$FUNCTION_URL" | sed 's|^http://||' | sed 's|/$||')

  echo "Slack handler Function URL: $FUNCTION_URL"
  echo ""
  echo "To expose to Slack via cloudflared:"
  echo "  cloudflared tunnel --url http://127.0.0.1:4566 --http-host-header ${FUNCTION_HOST}"
  echo ""
  echo "Then set the cloudflared HTTPS URL in your Slack app's Event Subscriptions and Slash Commands."
else
  echo "Note: Lambda Function URL not available."
fi
