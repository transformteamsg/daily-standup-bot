import { eq, and } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { dailyThreads } from "@/shell/db/schema/sqlite";
import type { DailyThreadRepository } from "@/core/ports";
import type { DailyThread, ConfigId } from "@/core/domain/standup";
import { DailyThreadId, ConfigId as mkConfigId } from "@/core/domain/standup";

export function createDailyThreadRepository(db: Db): DailyThreadRepository {
  return {
    async findByConfigAndDate(configId: ConfigId, date: string): Promise<DailyThread | null> {
      const row = await db
        .select()
        .from(dailyThreads)
        .where(and(eq(dailyThreads.configId, configId), eq(dailyThreads.date, date)))
        .get();
      return row ? toDailyThread(row) : null;
    },

    async save(thread: DailyThread): Promise<void> {
      await db
        .insert(dailyThreads)
        .values({
          id: thread.id,
          configId: thread.configId,
          date: thread.date,
          channelId: thread.channelId,
          threadTs: thread.threadTs,
          createdAt: thread.createdAt,
        })
        .onConflictDoNothing();
    },
  };
}

function toDailyThread(row: typeof dailyThreads.$inferSelect): DailyThread {
  return {
    id: DailyThreadId(row.id),
    configId: mkConfigId(row.configId),
    date: row.date,
    channelId: row.channelId,
    threadTs: row.threadTs,
    createdAt: row.createdAt,
  };
}
