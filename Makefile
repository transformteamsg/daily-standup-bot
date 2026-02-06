.PHONY: help tick tick-once build test

# LocalStack environment variables (matches scripts/localstack-deploy.sh)
export AWS_ACCESS_KEY_ID := test
export AWS_SECRET_ACCESS_KEY := test
export AWS_DEFAULT_REGION := ap-southeast-1
export AWS_ENDPOINT_URL := http://localhost:4566

# Default target
help:
	@echo "Available targets:"
	@echo "  tick       - Manually invoke tick Lambda every 60s (LocalStack)"
	@echo "  tick-once  - Invoke tick Lambda once (LocalStack)"
	@echo "  build      - Build Lambda handlers"
	@echo "  test       - Run tests"

# Manually invoke tick Lambda for testing/debugging
tick:
	@echo "Starting tick loop (Ctrl+C to stop)..."
	@while true; do \
		echo "[`date '+%Y-%m-%d %H:%M:%S'`] Invoking tick handler..."; \
		awslocal lambda invoke --function-name tfx-slack-bot-tick-handler /dev/stdout 2>/dev/null || echo "Failed to invoke"; \
		echo ""; \
		sleep 59; \
	done

# Invoke tick Lambda once
tick-once:
	awslocal lambda invoke --function-name tfx-slack-bot-tick-handler /dev/stdout

# Build Lambda handlers
build:
	pnpm build:lambda

# Run tests
test:
	pnpm test
