import { eq, and } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { members } from "@/shell/db/schema/postgres";
import type { MemberRepository } from "@/core/ports";
import type { Member, TeamId, MemberId } from "@/core/domain/standup";
import { MemberId as mkMemberId, TeamId as mkTeamId } from "@/core/domain/standup";

export function createMemberRepository(db: Db): MemberRepository {
  return {
    async findBySlackUserId(
      teamId: TeamId,
      slackUserId: string
    ): Promise<Member | null> {
      const [row] = await db
        .select()
        .from(members)
        .where(
          and(eq(members.teamId, teamId), eq(members.slackUserId, slackUserId))
        );
      return row ? toMember(row) : null;
    },

    async findBySlackUserIdGlobal(slackUserId: string): Promise<Member | null> {
      const [row] = await db
        .select()
        .from(members)
        .where(eq(members.slackUserId, slackUserId));
      return row ? toMember(row) : null;
    },

    async findById(id: MemberId): Promise<Member | null> {
      const [row] = await db
        .select()
        .from(members)
        .where(eq(members.id, id));
      return row ? toMember(row) : null;
    },

    async upsert(member: Member): Promise<void> {
      await db
        .insert(members)
        .values({
          id: member.id,
          teamId: member.teamId,
          slackUserId: member.slackUserId,
          displayName: member.displayName,
          timezone: member.timezone,
          createdAt: member.createdAt,
        })
        .onConflictDoUpdate({
          target: members.id,
          set: {
            displayName: member.displayName,
            timezone: member.timezone,
          },
        });
    },
  };
}

function toMember(row: typeof members.$inferSelect): Member {
  return {
    id: mkMemberId(row.id),
    teamId: mkTeamId(row.teamId),
    slackUserId: row.slackUserId,
    displayName: row.displayName,
    timezone: row.timezone,
    createdAt: row.createdAt,
  };
}
