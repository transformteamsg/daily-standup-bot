import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/shell/db/schema/postgres";
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
import type { Orchestrator } from "@/shell/orchestrator";
import type { Messenger, Clock, IdGenerator, Logger, UserResolver } from "@/core/ports";

export interface SentMessage {
  type: "dm" | "channel" | "thread";
  to: string;
  text: string;
  threadTs?: string;
}

export interface FakeMessenger extends Messenger {
  sent: SentMessage[];
  clear(): void;
}

export function createFakeMessenger(): FakeMessenger {
  const sent: SentMessage[] = [];
  return {
    sent,
    async sendDM(slackUserId: string, text: string) {
      sent.push({ type: "dm", to: slackUserId, text });
    },
    async postToChannel(channelId: string, text: string) {
      sent.push({ type: "channel", to: channelId, text });
    },
    async postToChannelWithTs(channelId: string, text: string) {
      sent.push({ type: "channel", to: channelId, text });
      return `ts-${sent.length}`;
    },
    async postToThread(channelId: string, threadTs: string, text: string) {
      sent.push({ type: "thread", to: channelId, text, threadTs });
    },
    async validateChannel(_channelId: string) {
      return { ok: true as const };
    },
    clear() {
      sent.length = 0;
    },
  };
}

export interface FakeClock extends Clock {
  set(date: Date): void;
  advance(ms: number): void;
}

export function createFakeClock(initial: Date = new Date("2025-01-06T09:00:00Z")): FakeClock {
  let current = new Date(initial);
  return {
    now: () => new Date(current),
    todayDateString: () => current.toISOString().slice(0, 10),
    toISOString: () => current.toISOString(),
    set(date: Date) {
      current = new Date(date);
    },
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

export function createTestIdGenerator(): IdGenerator {
  let counter = 0;
  return {
    generate: () => {
      counter++;
      return `test-id-${counter}`;
    },
  };
}

export function createTestLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

export interface TestHarness {
  orchestrator: Orchestrator;
  messenger: FakeMessenger;
  clock: FakeClock;
}

function createTestDb() {
  const client = new PGlite();
  return drizzle(client, { schema }) as any;
}

export async function createTestHarness(clockStart?: Date): Promise<TestHarness> {
  const db = createTestDb();
  await runMigrations(db);

  const messenger = createFakeMessenger();
  const clock = createFakeClock(clockStart);
  const idGen = createTestIdGenerator();
  const logger = createTestLogger();

  const userResolver: UserResolver = {
    async lookupByEmail() { return null; },
    async lookupByUserId() { return null; },
  };

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
    superadminUserId: "U_ADMIN",
  });

  return { orchestrator, messenger, clock };
}
