#!/bin/bash
set -euo pipefail

echo "Building Lambda bundles..."
pnpm build:lambda

echo "Deploying to LocalStack..."
cd infra

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing CDK dependencies..."
  pnpm install
fi

# Bootstrap and deploy using cdklocal
npx cdklocal bootstrap
npx cdklocal deploy --require-approval never \
  --parameters SlackBotToken="${SLACK_BOT_TOKEN:-xoxb-test}" \
  --parameters SlackSigningSecret="${SLACK_SIGNING_SECRET:-test-signing-secret}" \
  --parameters SuperadminUserId="${SUPERADMIN_USER_ID:-U_ADMIN}"

echo "Deployment complete!"
echo "API Gateway endpoint: http://localhost:4566/restapis"
