# Standup Bot

Slack bot that collects async standups via DMs and posts summaries to channels.

## Features

- `/tfx-standup` slash command for managing standups
- Async DM-based question/answer flow
- Automatic channel summaries on completion
- Configurable schedules, timeouts, and questions
- Skip support
- Timeout handling with partial summaries
- Multiple standups per workspace

## Tech Stack

- TypeScript, Node.js
- @slack/bolt (socket mode)
- Drizzle ORM + SQLite (better-sqlite3)
- Vitest with v8 coverage
- Zod validation
- node-cron scheduling
- Docker

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
    scheduler/    # node-cron wrapper
    orchestrator.ts
```

## Setup

### 1. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps), create a new app from `slack-app-manifest.yaml`, enable Socket Mode, and install to your workspace.
2. Create SLACK_BOT_TOKEN via `OAuth & Permissions` -> `OAuth Tokens`
3. Create SLACK_APP_TOKEN via `Basic Information` -> `App-Level Tokens`, with the scope `connections:write`, `authorizations:read`
4. Note down `Signing Secret` for `SLACK_SIGNING_SECRET` as well
5. Ensure `Allow users to send Slash commands and messages from the messages tab` is checked in `App Home`

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET
```

### 3. Install & Run

```bash
pnpm install
pnpm dev
```

### Docker

```bash
docker compose up --build
```

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

**days format:** `mon,tue,wed,thu,fri` or `weekdays` or `everyday`

## Message Flow

1. Cron fires at scheduled time
2. Bot creates sessions and sends first question via DM
3. User replies to each question in DM
4. On last answer, bot posts summary to the configured channel
5. If user doesn't reply within timeout, partial summary is posted

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

All E2E tests run without Slack credentials using a `FakeMessenger` and in-memory SQLite.

## Database

SQLite with Drizzle ORM. Tables:

- `teams` — Slack workspaces
- `members` — Slack users
- `standup_configs` — Standup configurations
- `standup_questions` — Questions per config
- `config_members` — Member-config associations
- `standup_sessions` — Per-member per-day sessions
- `standup_responses` — Individual answers
