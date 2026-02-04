import { eq, and } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { admins } from "@/shell/db/schema/postgres";
import type { AdminRepository } from "@/core/ports";
import type { Admin, TeamId } from "@/core/domain/standup";
import { AdminId, TeamId as mkTeamId } from "@/core/domain/standup";

export function createAdminRepository(db: Db): AdminRepository {
  return {
    async findByTeamAndSlackUserId(teamId: TeamId, slackUserId: string): Promise<Admin | null> {
      const [row] = await db
        .select()
        .from(admins)
        .where(and(eq(admins.teamId, teamId), eq(admins.slackUserId, slackUserId)));
      return row ? toAdmin(row) : null;
    },

    async findByTeam(teamId: TeamId): Promise<readonly Admin[]> {
      const rows = await db
        .select()
        .from(admins)
        .where(eq(admins.teamId, teamId));
      return rows.map(toAdmin);
    },

    async save(admin: Admin): Promise<void> {
      await db
        .insert(admins)
        .values({
          id: admin.id,
          teamId: admin.teamId,
          slackUserId: admin.slackUserId,
          createdAt: admin.createdAt,
        })
        .onConflictDoNothing();
    },

    async delete(teamId: TeamId, slackUserId: string): Promise<void> {
      await db
        .delete(admins)
        .where(and(eq(admins.teamId, teamId), eq(admins.slackUserId, slackUserId)));
    },
  };
}

function toAdmin(row: typeof admins.$inferSelect): Admin {
  return {
    id: AdminId(row.id),
    teamId: mkTeamId(row.teamId),
    slackUserId: row.slackUserId,
    createdAt: row.createdAt,
  };
}
