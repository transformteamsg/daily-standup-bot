import { pgTable, text, integer, boolean, primaryKey, unique } from "drizzle-orm/pg-core";

export const teams = pgTable("teams", {
  id: text("id").primaryKey(),
  slackTeamId: text("slack_team_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const members = pgTable("members", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  slackUserId: text("slack_user_id").notNull(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: text("created_at").notNull(),
});

export const standupConfigs = pgTable("standup_configs", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  name: text("name").notNull(),
  channelId: text("channel_id").notNull(),
  scheduleJson: text("schedule_json"), // JSON string of Schedule
  timeoutMinutes: integer("timeout_minutes").notNull().default(60),
  active: boolean("active").notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const standupQuestions = pgTable("standup_questions", {
  id: text("id").primaryKey(),
  configId: text("config_id")
    .notNull()
    .references(() => standupConfigs.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  order: integer("order").notNull(),
});

export const configMembers = pgTable("config_members", {
  configId: text("config_id")
    .notNull()
    .references(() => standupConfigs.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
});

export const standupSessions = pgTable("standup_sessions", {
  id: text("id").primaryKey(),
  configId: text("config_id")
    .notNull()
    .references(() => standupConfigs.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  date: text("date").notNull(), // YYYY-MM-DD
  status: text("status").notNull(), // pending | questions_delivered | in_progress | completed | skipped | timed_out
  currentQuestionIndex: integer("current_question_index"),
  deliveredAt: text("delivered_at"),
  completedAt: text("completed_at"),
  skippedAt: text("skipped_at"),
  timedOutAt: text("timed_out_at"),
  createdAt: text("created_at").notNull(),
});

export const standupResponses = pgTable("standup_responses", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => standupSessions.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull(),
  questionText: text("question_text").notNull(),
  answer: text("answer").notNull(),
  answeredAt: text("answered_at").notNull(),
});

export const admins = pgTable("admins", {
  id: text("id").primaryKey(),
  teamId: text("team_id")
    .notNull()
    .references(() => teams.id),
  slackUserId: text("slack_user_id").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  unique().on(table.teamId, table.slackUserId),
]);

export const dailyThreads = pgTable("daily_threads", {
  id: text("id").primaryKey(),
  configId: text("config_id")
    .notNull()
    .references(() => standupConfigs.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  channelId: text("channel_id").notNull(),
  threadTs: text("thread_ts").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  unique().on(table.configId, table.date),
]);

export const reportSubscriptions = pgTable("report_subscriptions", {
  configId: text("config_id")
    .notNull()
    .references(() => standupConfigs.id, { onDelete: "cascade" }),
  subscriberSlackUserId: text("subscriber_slack_user_id").notNull(),
  targetMemberId: text("target_member_id")
    .notNull()
    .references(() => members.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.configId, table.subscriberSlackUserId, table.targetMemberId] }),
]);
