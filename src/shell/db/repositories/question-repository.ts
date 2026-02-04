import { eq } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { standupQuestions } from "@/shell/db/schema/postgres";
import type { QuestionRepository } from "@/core/ports";
import type { StandupQuestion, ConfigId } from "@/core/domain/standup";
import { QuestionId, ConfigId as mkConfigId } from "@/core/domain/standup";

export function createQuestionRepository(db: Db): QuestionRepository {
  return {
    async findByConfigId(
      configId: ConfigId
    ): Promise<readonly StandupQuestion[]> {
      const rows = await db
        .select()
        .from(standupQuestions)
        .where(eq(standupQuestions.configId, configId));
      return rows.map(toQuestion);
    },

    async save(question: StandupQuestion): Promise<void> {
      await db.insert(standupQuestions).values({
        id: question.id,
        configId: question.configId,
        text: question.text,
        order: question.order,
      });
    },

    async deleteById(id: string): Promise<void> {
      await db
        .delete(standupQuestions)
        .where(eq(standupQuestions.id, id));
    },

    async deleteByConfigId(configId: ConfigId): Promise<void> {
      await db
        .delete(standupQuestions)
        .where(eq(standupQuestions.configId, configId));
    },

    async updateOrder(id: string, order: number): Promise<void> {
      await db
        .update(standupQuestions)
        .set({ order })
        .where(eq(standupQuestions.id, id));
    },
  };
}

function toQuestion(row: typeof standupQuestions.$inferSelect): StandupQuestion {
  return {
    id: QuestionId(row.id),
    configId: mkConfigId(row.configId),
    text: row.text,
    order: row.order,
  };
}
