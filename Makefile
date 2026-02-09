.PHONY: help build test

# LocalStack environment variables (matches scripts/localstack-deploy.sh)
export AWS_ACCESS_KEY_ID := test
export AWS_SECRET_ACCESS_KEY := test
export AWS_DEFAULT_REGION := ap-southeast-1
export AWS_ENDPOINT_URL := http://localhost:4566

# Default target
help:
	@echo "Available targets:"
	@echo "  build      - Build Lambda handlers"
	@echo "  test       - Run tests"

# Build Lambda handlers
build:
	pnpm build:lambda

# Run tests
test:
	pnpm test
