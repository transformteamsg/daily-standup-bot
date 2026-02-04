import { eq, and } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { reportSubscriptions } from "@/shell/db/schema/postgres";
import type { ReportSubscriptionRepository } from "@/core/ports";
import type { ReportSubscription, ConfigId, MemberId } from "@/core/domain/standup";
import { ConfigId as mkConfigId, MemberId as mkMemberId } from "@/core/domain/standup";

export function createReportSubscriptionRepository(db: Db): ReportSubscriptionRepository {
  return {
    async findBySubscriber(configId: ConfigId, subscriberSlackUserId: string): Promise<readonly ReportSubscription[]> {
      const rows = await db
        .select()
        .from(reportSubscriptions)
        .where(
          and(
            eq(reportSubscriptions.configId, configId),
            eq(reportSubscriptions.subscriberSlackUserId, subscriberSlackUserId)
          )
        );
      return rows.map(toSubscription);
    },

    async findSubscribersForConfig(configId: ConfigId): Promise<readonly ReportSubscription[]> {
      const rows = await db
        .select()
        .from(reportSubscriptions)
        .where(eq(reportSubscriptions.configId, configId));
      return rows.map(toSubscription);
    },

    async save(subscription: ReportSubscription): Promise<void> {
      await db
        .insert(reportSubscriptions)
        .values({
          configId: subscription.configId,
          subscriberSlackUserId: subscription.subscriberSlackUserId,
          targetMemberId: subscription.targetMemberId,
          createdAt: subscription.createdAt,
        })
        .onConflictDoNothing();
    },

    async delete(configId: ConfigId, subscriberSlackUserId: string, targetMemberId: MemberId): Promise<void> {
      await db
        .delete(reportSubscriptions)
        .where(
          and(
            eq(reportSubscriptions.configId, configId),
            eq(reportSubscriptions.subscriberSlackUserId, subscriberSlackUserId),
            eq(reportSubscriptions.targetMemberId, targetMemberId)
          )
        );
    },

    async deleteByConfigId(configId: ConfigId): Promise<void> {
      await db
        .delete(reportSubscriptions)
        .where(eq(reportSubscriptions.configId, configId));
    },
  };
}

function toSubscription(row: typeof reportSubscriptions.$inferSelect): ReportSubscription {
  return {
    configId: mkConfigId(row.configId),
    subscriberSlackUserId: row.subscriberSlackUserId,
    targetMemberId: mkMemberId(row.targetMemberId),
    createdAt: row.createdAt,
  };
}
