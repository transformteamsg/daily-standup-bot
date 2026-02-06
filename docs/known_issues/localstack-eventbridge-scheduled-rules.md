# LocalStack EventBridge Scheduled Rules Don't Fire

## Issue

EventBridge scheduled rules (using `rate()` or `cron()` expressions) do not actually trigger Lambda functions in LocalStack's free/community tier. The rules are created successfully, but the scheduler only provides "mocked functionality" - meaning the rules exist but never fire.

This affects the `tfx-slack-bot-tick-rule` which is configured to run every minute via `rate(1 minute)`.

## Status

This is a known limitation of LocalStack. See:
- [GitHub Issue #10239: EventBridge Scheduler Cron Jobs Not Running](https://github.com/localstack/localstack/issues/10239)
- [LocalStack EventBridge Scheduler Docs](https://docs.localstack.cloud/aws/services/scheduler/) - notes that Scheduler provides "mocked functionality"

## Workaround

Use the Makefile to manually simulate the scheduled rule:

```bash
# Invoke tick Lambda continuously every 60 seconds
make tick

# Invoke tick Lambda once
make tick-once
```

Or invoke directly via AWS CLI:

```bash
# Single invocation
awslocal lambda invoke --function-name tfx-slack-bot-tick-handler /dev/stdout

# Continuous loop
while true; do awslocal lambda invoke --function-name tfx-slack-bot-tick-handler /dev/stdout; sleep 60; done
```

## Impact

- **Local development**: Requires manual invocation or `make tick` to test scheduled functionality
- **Production (AWS)**: Not affected - EventBridge scheduled rules work correctly on real AWS

## Resolution

This issue is in LocalStack's backlog. Options:
1. Use `make tick` workaround (current approach)
2. Upgrade to LocalStack Pro (supports scheduled rules)
3. Wait for LocalStack to fix the issue in community edition
