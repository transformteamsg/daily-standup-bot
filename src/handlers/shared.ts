import { v4 as uuidv4 } from "uuid";
import { WebClient } from "@slack/web-api";
import { envSchema } from "@/schemas/env";
import { createDb } from "@/shell/db/client";
import { runMigrations } from "@/shell/db/migrate";
import { createTeamRepository } from "@/shell/db/repositories/team-repository";
import { createMemberRepository } from "@/shell/db/repositories/member-repository";
import { createConfigRepository } from "@/shell/db/repositories/config-repository";
import { createQuestionRepository } from "@/shell/db/repositories/question-repository";
import { createConfigMemberRepository } from "@/shell/db/repositories/config-member-repository";
import { createSessionRepository } from "@/shell/db/repositories/session-repository";
import { createAdminRepository } from "@/shell/db/repositories/admin-repository";
import { createDailyThreadRepository } from "@/shell/db/repositories/daily-thread-repository";
import { createReportSubscriptionRepository } from "@/shell/db/repositories/report-subscription-repository";
import { createOrchestrator } from "@/shell/orchestrator";
import { createSlackMessenger } from "@/shell/slack/messenger";
import { createSlackUserResolver } from "@/shell/slack/user-resolver";
import type { Clock, IdGenerator, Logger } from "@/core/ports";

export function createLogger(_level: string): Logger {
  const fmt = (meta: unknown) => (meta ? JSON.stringify(meta) : "");
  return {
    info: (msg, meta) => console.log(`[INFO] ${msg} ${fmt(meta)}`),
    warn: (msg, meta) => console.warn(`[WARN] ${msg} ${fmt(meta)}`),
    error: (msg, meta) => console.error(`[ERROR] ${msg} ${fmt(meta)}`),
  };
}

export function createDependencies() {
  const env = envSchema.parse(process.env);
  const db = createDb(env.DATABASE_URL);
  const migrationPromise = runMigrations(db);

  const logger = createLogger(env.LOG_LEVEL);
  const client = new WebClient(env.SLACK_BOT_TOKEN);
  const messenger = createSlackMessenger(client, logger);
  const userResolver = createSlackUserResolver(client);

  const clock: Clock = {
    now: () => new Date(),
    todayDateString: () => new Date().toISOString().slice(0, 10),
    toISOString: () => new Date().toISOString(),
  };

  const idGen: IdGenerator = { generate: () => uuidv4() };

  const orchestrator = createOrchestrator({
    teamRepo: createTeamRepository(db),
    memberRepo: createMemberRepository(db),
    configRepo: createConfigRepository(db),
    questionRepo: createQuestionRepository(db),
    configMemberRepo: createConfigMemberRepository(db),
    sessionRepo: createSessionRepository(db),
    adminRepo: createAdminRepository(db),
    dailyThreadRepo: createDailyThreadRepository(db),
    subscriptionRepo: createReportSubscriptionRepository(db),
    messenger,
    clock,
    idGen,
    logger,
    userResolver,
    superadminUserId: env.SUPERADMIN_USER_ID,
  });

  return { env, db, orchestrator, logger, messenger, userResolver, migrationPromise };
}
