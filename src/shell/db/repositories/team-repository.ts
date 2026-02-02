import { eq } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { teams } from "@/shell/db/schema/sqlite";
import type { TeamRepository } from "@/core/ports";
import type { Team } from "@/core/domain/standup";
import { TeamId } from "@/core/domain/standup";

export function createTeamRepository(db: Db): TeamRepository {
  return {
    async findBySlackTeamId(slackTeamId: string): Promise<Team | null> {
      const row = await db
        .select()
        .from(teams)
        .where(eq(teams.slackTeamId, slackTeamId))
        .get();
      return row ? toTeam(row) : null;
    },

    async upsert(team: Team): Promise<void> {
      await db
        .insert(teams)
        .values({
          id: team.id,
          slackTeamId: team.slackTeamId,
          name: team.name,
          createdAt: team.createdAt,
        })
        .onConflictDoUpdate({
          target: teams.id,
          set: { name: team.name },
        });
    },
  };
}

function toTeam(row: typeof teams.$inferSelect): Team {
  return {
    id: TeamId(row.id),
    slackTeamId: row.slackTeamId,
    name: row.name,
    createdAt: row.createdAt,
  };
}
