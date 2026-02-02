import { eq, and } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { standupConfigs } from "@/shell/db/schema/sqlite";
import type { ConfigRepository } from "@/core/ports";
import type { StandupConfig, TeamId, ConfigId, Schedule } from "@/core/domain/standup";
import { ConfigId as mkConfigId, TeamId as mkTeamId } from "@/core/domain/standup";

export function createConfigRepository(db: Db): ConfigRepository {
  return {
    async findById(id: ConfigId): Promise<StandupConfig | null> {
      const row = await db
        .select()
        .from(standupConfigs)
        .where(eq(standupConfigs.id, id))
        .get();
      return row ? toConfig(row) : null;
    },

    async findByName(
      teamId: TeamId,
      name: string
    ): Promise<StandupConfig | null> {
      const row = await db
        .select()
        .from(standupConfigs)
        .where(
          and(eq(standupConfigs.teamId, teamId), eq(standupConfigs.name, name))
        )
        .get();
      return row ? toConfig(row) : null;
    },

    async findActiveByTeam(teamId: TeamId): Promise<readonly StandupConfig[]> {
      const rows = await db
        .select()
        .from(standupConfigs)
        .where(
          and(eq(standupConfigs.teamId, teamId), eq(standupConfigs.active, true))
        )
        .all();
      return rows.map(toConfig);
    },

    async findAllActive(): Promise<readonly StandupConfig[]> {
      const rows = await db
        .select()
        .from(standupConfigs)
        .where(eq(standupConfigs.active, true))
        .all();
      return rows.map(toConfig);
    },

    async findAll(teamId: TeamId): Promise<readonly StandupConfig[]> {
      const rows = await db
        .select()
        .from(standupConfigs)
        .where(eq(standupConfigs.teamId, teamId))
        .all();
      return rows.map(toConfig);
    },

    async save(config: StandupConfig): Promise<void> {
      await db.insert(standupConfigs).values({
        id: config.id,
        teamId: config.teamId,
        name: config.name,
        channelId: config.channelId,
        scheduleJson: config.schedule ? JSON.stringify(config.schedule) : null,
        timeoutMinutes: config.timeoutMinutes,
        active: config.active,
        createdAt: config.createdAt,
      });
    },

    async update(config: StandupConfig): Promise<void> {
      await db
        .update(standupConfigs)
        .set({
          name: config.name,
          channelId: config.channelId,
          scheduleJson: config.schedule
            ? JSON.stringify(config.schedule)
            : null,
          timeoutMinutes: config.timeoutMinutes,
          active: config.active,
        })
        .where(eq(standupConfigs.id, config.id));
    },

    async delete(id: ConfigId): Promise<void> {
      await db
        .delete(standupConfigs)
        .where(eq(standupConfigs.id, id));
    },
  };
}

function toConfig(row: typeof standupConfigs.$inferSelect): StandupConfig {
  let schedule: Schedule | null = null;
  if (row.scheduleJson) {
    schedule = JSON.parse(row.scheduleJson) as Schedule;
  }
  return {
    id: mkConfigId(row.id),
    teamId: mkTeamId(row.teamId),
    name: row.name,
    channelId: row.channelId,
    schedule,
    timeoutMinutes: row.timeoutMinutes,
    active: row.active,
    createdAt: row.createdAt,
  };
}
