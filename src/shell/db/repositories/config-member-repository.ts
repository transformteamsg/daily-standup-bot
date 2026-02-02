import { eq, and } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { configMembers, members, standupConfigs } from "@/shell/db/schema/sqlite";
import type { ConfigMemberRepository } from "@/core/ports";
import type { Member, StandupConfig, ConfigId, MemberId, Schedule } from "@/core/domain/standup";
import {
  MemberId as mkMemberId,
  TeamId as mkTeamId,
  ConfigId as mkConfigId,
} from "@/core/domain/standup";

export function createConfigMemberRepository(db: Db): ConfigMemberRepository {
  return {
    async findMembersByConfig(configId: ConfigId): Promise<readonly Member[]> {
      const rows = await db
        .select({ member: members })
        .from(configMembers)
        .innerJoin(members, eq(configMembers.memberId, members.id))
        .where(eq(configMembers.configId, configId))
        .all();
      return rows.map((r) => ({
        id: mkMemberId(r.member.id),
        teamId: mkTeamId(r.member.teamId),
        slackUserId: r.member.slackUserId,
        displayName: r.member.displayName,
        timezone: r.member.timezone,
        createdAt: r.member.createdAt,
      }));
    },

    async findConfigsByMember(
      memberId: MemberId
    ): Promise<readonly StandupConfig[]> {
      const rows = await db
        .select({ config: standupConfigs })
        .from(configMembers)
        .innerJoin(standupConfigs, eq(configMembers.configId, standupConfigs.id))
        .where(eq(configMembers.memberId, memberId))
        .all();
      return rows.map((r) => {
        let schedule: Schedule | null = null;
        if (r.config.scheduleJson) {
          schedule = JSON.parse(r.config.scheduleJson) as Schedule;
        }
        return {
          id: mkConfigId(r.config.id),
          teamId: mkTeamId(r.config.teamId),
          name: r.config.name,
          channelId: r.config.channelId,
          schedule,
          timeoutMinutes: r.config.timeoutMinutes,
          active: r.config.active,
          createdAt: r.config.createdAt,
        };
      });
    },

    async addMember(configId: ConfigId, memberId: MemberId): Promise<void> {
      await db
        .insert(configMembers)
        .values({ configId, memberId })
        .onConflictDoNothing();
    },

    async removeMember(configId: ConfigId, memberId: MemberId): Promise<void> {
      await db
        .delete(configMembers)
        .where(
          and(
            eq(configMembers.configId, configId),
            eq(configMembers.memberId, memberId)
          )
        );
    },
  };
}
