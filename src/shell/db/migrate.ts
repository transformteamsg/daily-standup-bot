import { sql } from "drizzle-orm";
import type { Db } from "@/shell/db/client";

export function runMigrations(db: Db) {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      slack_team_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      slack_user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS standup_configs (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      name TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      schedule_json TEXT,
      timeout_minutes INTEGER NOT NULL DEFAULT 60,
      active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS standup_questions (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL REFERENCES standup_configs(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      "order" INTEGER NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS config_members (
      config_id TEXT NOT NULL REFERENCES standup_configs(id) ON DELETE CASCADE,
      member_id TEXT NOT NULL REFERENCES members(id),
      PRIMARY KEY (config_id, member_id)
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS standup_sessions (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL REFERENCES standup_configs(id),
      member_id TEXT NOT NULL REFERENCES members(id),
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      current_question_index INTEGER,
      delivered_at TEXT,
      completed_at TEXT,
      skipped_at TEXT,
      timed_out_at TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS standup_responses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES standup_sessions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      answer TEXT NOT NULL,
      answered_at TEXT NOT NULL
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES teams(id),
      slack_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(team_id, slack_user_id)
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS daily_threads (
      id TEXT PRIMARY KEY,
      config_id TEXT NOT NULL REFERENCES standup_configs(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      thread_ts TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(config_id, date)
    )
  `);

  db.run(sql`
    CREATE TABLE IF NOT EXISTS report_subscriptions (
      config_id TEXT NOT NULL REFERENCES standup_configs(id) ON DELETE CASCADE,
      subscriber_slack_user_id TEXT NOT NULL,
      target_member_id TEXT NOT NULL REFERENCES members(id),
      created_at TEXT NOT NULL,
      PRIMARY KEY (config_id, subscriber_slack_user_id, target_member_id)
    )
  `);
}
