# Standup Bot

Slack bot that collects async standups via DMs and posts summaries to channels.

## Features

- `/tfx-standup` slash command for managing standups
- Async DM-based question/answer flow
- Automatic channel summaries grouped in daily threads
- Configurable schedules, timeouts, and questions
- Skip support
- Timeout handling with partial summaries
- Multiple standups per workspace
- Superadmin/admin role system with command access control
- Aggregated report subscriptions (get a DM when watched members finish)

## Tech Stack

- TypeScript, Node.js 20
- @slack/bolt (HTTP mode via `AwsLambdaReceiver`)
- Drizzle ORM + PostgreSQL (pg)
- AWS Lambda, API Gateway, EventBridge, RDS
- Terragrunt + Terraform (infrastructure as code)
- LocalStack for local development
- Vitest with v8 coverage
- Zod validation
- esbuild (Lambda bundling)

## Architecture

**Functional Core / Imperative Shell**

```
src/
  core/           # Pure functions, no I/O
    domain/       # Types, branded IDs, discriminated unions
    standup/      # State machine, questions, formatting, scheduling
    config/       # Validation, command parsing
    ports.ts      # Repository/adapter interfaces

  shell/          # Side effects, I/O adapters
    slack/        # Bolt app, messenger, listeners
    db/           # Drizzle client, schema, repositories
    orchestrator.ts

  handlers/       # Lambda entry points
    shared.ts     # Shared dependency wiring
    slack.ts      # Slack events handler (slash commands, DMs)
    tick.ts       # Scheduled tick handler (triggers, timeouts)

infra/            # Terragrunt + Terraform
  modules/        # Terraform modules (vpc, rds, lambda, etc.)
  env/prod/       # Per-environment Terragrunt configs
```

### AWS Resources

| Resource | Details |
|---|---|
| VPC | 2 AZs, private subnets (Lambda + RDS), public subnets (NAT) |
| RDS PostgreSQL | PostgreSQL 16, `db.t3.micro`, single-AZ, 20GB gp3 |
| Lambda (slack) | Node 20, 256MB, 30s timeout, VPC-attached |
| Lambda (tick) | Node 20, 256MB, 60s timeout, VPC-attached |
| API Gateway | HTTP API, `POST /slack/events` -> slack Lambda |
| EventBridge | `rate(1 minute)` -> tick Lambda |

## Setup

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps), create a new app from `slack-app-manifest.yaml` and install to your workspace.
2. Create SLACK_BOT_TOKEN via `OAuth & Permissions` -> `OAuth Tokens`
3. Note down `Signing Secret` for `SLACK_SIGNING_SECRET`
4. Ensure `Allow users to send Slash commands and messages from the messages tab` is checked in `App Home`

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, SUPERADMIN_USER_ID
```

`SUPERADMIN_USER_ID` is the Slack user ID of the bot superadmin. This user can manage admins and has full command access. Find your Slack user ID in your Slack profile.

### 3. Local Development

Start LocalStack and PostgreSQL:

```bash
docker compose up -d
```

Install dependencies and build Lambda bundles:

```bash
pnpm install
pnpm build:lambda
```

Deploy to LocalStack:

```bash
./scripts/localstack-deploy.sh
```

Use ngrok or a tunnel to expose the LocalStack API Gateway endpoint to Slack, then configure your Slack app's Request URL to point at the tunnel.

### 4. Production Deployment

First-time setup — bootstrap the Terraform state backend:

```bash
cd infra/bootstrap
terraform init && terraform apply
```

Build Lambda bundles and deploy all infrastructure:

```bash
pnpm build:lambda

export TF_VAR_slack_bot_token=xoxb-...
export TF_VAR_slack_signing_secret=...
export TF_VAR_superadmin_user_id=U...

cd infra/env/prod
terragrunt run-all apply
```

Get the Slack Request URL from the API Gateway output:

```bash
cd infra/env/prod/api-gateway
terragrunt output slack_request_url
```

Set this as your Slack app's Request URL.

## Commands

| Command | Description |
|---|---|
| `/tfx-standup create <name> <#channel>` | Create a new standup |
| `/tfx-standup list` | List all standups |
| `/tfx-standup show <name>` | Show standup details |
| `/tfx-standup schedule <name> <HH:MM> <days> <tz>` | Set schedule |
| `/tfx-standup add-question <name> <text>` | Add a question |
| `/tfx-standup remove-question <name> <#>` | Remove question by number |
| `/tfx-standup add-members <name> @users` | Add members |
| `/tfx-standup remove-members <name> @users` | Remove members |
| `/tfx-standup timeout <name> <minutes>` | Set timeout (5-480) |
| `/tfx-standup activate <name>` | Activate |
| `/tfx-standup deactivate <name>` | Deactivate |
| `/tfx-standup delete <name>` | Delete |
| `/tfx-standup help` | Show help |

**Admin commands (superadmin only):**

| Command | Description |
|---|---|
| `/tfx-standup add-admin @users` | Add admins |
| `/tfx-standup remove-admin @users` | Remove admins |
| `/tfx-standup list-admins` | List all admins |

**Report subscriptions:**

| Command | Description |
|---|---|
| `/tfx-standup subscribe <name> @users` | Get a DM when these members finish |
| `/tfx-standup unsubscribe <name> @users` | Stop getting DMs for these members |

**days format:** `mon,tue,wed,thu,fri` or `weekdays` or `everyday`

## Access Control

Most commands require admin or superadmin access. The `SUPERADMIN_USER_ID` env var designates the superadmin, who can then grant admin access to other users via `/tfx-standup add-admin @user`. The only command available to all users is `/tfx-standup help`.

## Channel Access

The bot can only post to channels it's a member of. Before creating a standup, invite the bot to the target channel with `/invite @TFX Standup Bot`. This applies to both public and private channels.

If you update the manifest after initial installation, reinstall the app in Slack to pick up the new scopes.

## Message Flow

1. EventBridge fires tick Lambda every minute
2. Tick checks schedules and creates sessions, sends first question via DM
3. User replies to each question in DM (via API Gateway -> slack Lambda)
4. On last answer, bot posts summary as a reply in the daily thread
5. If user doesn't reply within timeout, partial summary is posted to the thread
6. If an admin has subscribed to members, they receive an aggregated DM once all watched members finish

Each day's standup summaries are grouped under a daily thread in the channel.

Users can reply `skip` to skip the standup.

## Testing

```bash
# All tests
pnpm test

# Core unit tests with coverage
pnpm run test:core

# E2E scenario tests
pnpm run test:e2e

# Watch mode
pnpm run test:watch
```

### E2E Scenarios

E2E tests are defined as YAML files in `tests/e2e/scenarios/`:

| Scenario | Description |
|---|---|
| `happy-path` | Single member completes all questions |
| `multi-member` | Multiple members answer independently |
| `partial-timeout` | Member answers partially, then times out |
| `full-timeout` | Member never replies |
| `skip` | Member skips via "skip" reply |
| `already-answered` | No duplicate DM on re-trigger |
| `config-crud` | Full config lifecycle |

All E2E tests run without Slack credentials using a `FakeMessenger` and in-process pglite (PostgreSQL).

## Database

PostgreSQL with Drizzle ORM. Tables:

- `teams` — Slack workspaces
- `members` — Slack users
- `standup_configs` — Standup configurations
- `standup_questions` — Questions per config
- `config_members` — Member-config associations
- `standup_sessions` — Per-member per-day sessions
- `standup_responses` — Individual answers
- `admins` — Admin role assignments per team
- `daily_threads` — Daily thread timestamps per config per day
- `report_subscriptions` — Aggregated report subscriptions
