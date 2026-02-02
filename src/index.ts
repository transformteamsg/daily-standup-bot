import { v4 as uuidv4 } from "uuid";
import { envSchema } from "@/schemas/env";
import { createSlackApp } from "@/shell/slack/app";
import { createSlackMessenger } from "@/shell/slack/messenger";
import { createSlackUserResolver } from "@/shell/slack/user-resolver";
import { createDb } from "@/shell/db/client";
import { runMigrations } from "@/shell/db/migrate";
import { createTeamRepository } from "@/shell/db/repositories/team-repository";
import { createMemberRepository } from "@/shell/db/repositories/member-repository";
import { createConfigRepository } from "@/shell/db/repositories/config-repository";
import { createQuestionRepository } from "@/shell/db/repositories/question-repository";
import { createConfigMemberRepository } from "@/shell/db/repositories/config-member-repository";
import { createSessionRepository } from "@/shell/db/repositories/session-repository";
import { createOrchestrator } from "@/shell/orchestrator";
import { registerCommandListener } from "@/shell/slack/listeners/command-listener";
import { registerMessageListener } from "@/shell/slack/listeners/message-listener";
import { scheduleEveryMinute } from "@/shell/scheduler/cron-scheduler";
import type { Clock, IdGenerator, Logger } from "@/core/ports";

const env = envSchema.parse(process.env);

const db = createDb(env.DATABASE_URL);
runMigrations(db);

const app = createSlackApp(env);
const messenger = createSlackMessenger(app);
const userResolver = createSlackUserResolver(app);

const clock: Clock = {
  now: () => new Date(),
  todayDateString: () => new Date().toISOString().slice(0, 10),
  toISOString: () => new Date().toISOString(),
};

const idGen: IdGenerator = { generate: () => uuidv4() };

const logger: Logger = {
  info: (msg, meta) => console.log(`[INFO] ${msg}`, meta ?? ""),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta ?? ""),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta ?? ""),
};

const orchestrator = createOrchestrator({
  teamRepo: createTeamRepository(db),
  memberRepo: createMemberRepository(db),
  configRepo: createConfigRepository(db),
  questionRepo: createQuestionRepository(db),
  configMemberRepo: createConfigMemberRepository(db),
  sessionRepo: createSessionRepository(db),
  messenger,
  clock,
  idGen,
  logger,
  userResolver,
});

registerCommandListener(app, orchestrator);
registerMessageListener(app, orchestrator);

// Check schedules and timeouts every minute
scheduleEveryMinute(() => orchestrator.tick(), logger);

(async () => {
  await app.start();
  logger.info("Standup bot is running");
})();
