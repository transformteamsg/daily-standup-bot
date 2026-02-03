import { eq, and, inArray } from "drizzle-orm";
import type { Db } from "@/shell/db/client";
import { standupSessions, standupResponses } from "@/shell/db/schema/sqlite";
import type { SessionRepository, ResponseRepository } from "@/core/ports";
import type {
  StandupSession,
  StandupResponse,
  SessionId,
  ConfigId,
  MemberId,
} from "@/core/domain/standup";
import {
  SessionId as mkSessionId,
  ConfigId as mkConfigId,
  MemberId as mkMemberId,
  ResponseId,
  QuestionId,
} from "@/core/domain/standup";

const ACTIVE_STATUSES = ["pending", "questions_delivered", "in_progress"];

export function createSessionRepository(db: Db): SessionRepository {
  return {
    async findById(id: SessionId): Promise<StandupSession | null> {
      const row = await db
        .select()
        .from(standupSessions)
        .where(eq(standupSessions.id, id))
        .get();
      if (!row) return null;
      const responses = await loadResponses(db, mkSessionId(row.id));
      return toSession(row, responses);
    },

    async findByConfigAndDate(
      configId: ConfigId,
      date: string
    ): Promise<readonly StandupSession[]> {
      const rows = await db
        .select()
        .from(standupSessions)
        .where(
          and(
            eq(standupSessions.configId, configId),
            eq(standupSessions.date, date)
          )
        )
        .all();
      return Promise.all(
        rows.map(async (row) => {
          const responses = await loadResponses(db, mkSessionId(row.id));
          return toSession(row, responses);
        })
      );
    },

    async findByMemberAndDate(
      memberId: MemberId,
      date: string
    ): Promise<readonly StandupSession[]> {
      const rows = await db
        .select()
        .from(standupSessions)
        .where(
          and(
            eq(standupSessions.memberId, memberId),
            eq(standupSessions.date, date)
          )
        )
        .all();
      return Promise.all(
        rows.map(async (row) => {
          const responses = await loadResponses(db, mkSessionId(row.id));
          return toSession(row, responses);
        })
      );
    },

    async findActiveByMember(
      memberId: MemberId
    ): Promise<StandupSession | null> {
      const row = await db
        .select()
        .from(standupSessions)
        .where(
          and(
            eq(standupSessions.memberId, memberId),
            inArray(standupSessions.status, ACTIVE_STATUSES)
          )
        )
        .get();
      if (!row) return null;
      const responses = await loadResponses(db, mkSessionId(row.id));
      return toSession(row, responses);
    },

    async findExpiredSessions(
      beforeTime: string
    ): Promise<readonly StandupSession[]> {
      const rows = await db
        .select()
        .from(standupSessions)
        .where(
          inArray(standupSessions.status, [
            "questions_delivered",
            "in_progress",
          ])
        )
        .all();

      // Filter in application code since SQLite date comparison is string-based
      const expired = rows.filter(
        (r) => r.deliveredAt != null && r.deliveredAt <= beforeTime
      );
      return Promise.all(
        expired.map(async (row) => {
          const responses = await loadResponses(db, mkSessionId(row.id));
          return toSession(row, responses);
        })
      );
    },

    async save(session: StandupSession): Promise<void> {
      await db.insert(standupSessions).values(toRow(session));
      if ("responses" in session) {
        for (const resp of session.responses) {
          await db.insert(standupResponses).values({
            id: resp.id,
            sessionId: session.id,
            questionId: resp.questionId,
            questionText: resp.questionText,
            answer: resp.answer,
            answeredAt: resp.answeredAt,
          });
        }
      }
    },

    async deleteByConfigId(configId: ConfigId): Promise<void> {
      await db.delete(standupSessions).where(eq(standupSessions.configId, configId));
    },

    async update(session: StandupSession): Promise<void> {
      await db
        .update(standupSessions)
        .set(toRow(session))
        .where(eq(standupSessions.id, session.id));

      if ("responses" in session) {
        // Upsert responses
        for (const resp of session.responses) {
          await db
            .insert(standupResponses)
            .values({
              id: resp.id,
              sessionId: session.id,
              questionId: resp.questionId,
              questionText: resp.questionText,
              answer: resp.answer,
              answeredAt: resp.answeredAt,
            })
            .onConflictDoNothing();
        }
      }
    },
  };
}

export function createResponseRepository(db: Db): ResponseRepository {
  return {
    async findBySessionId(
      sessionId: SessionId
    ): Promise<readonly StandupResponse[]> {
      return loadResponses(db, sessionId);
    },

    async save(response: StandupResponse): Promise<void> {
      await db.insert(standupResponses).values({
        id: response.id,
        sessionId: response.sessionId,
        questionId: response.questionId,
        questionText: response.questionText,
        answer: response.answer,
        answeredAt: response.answeredAt,
      });
    },
  };
}

async function loadResponses(
  db: Db,
  sessionId: SessionId
): Promise<StandupResponse[]> {
  const rows = await db
    .select()
    .from(standupResponses)
    .where(eq(standupResponses.sessionId, sessionId))
    .all();
  return rows.map((r) => ({
    id: ResponseId(r.id),
    sessionId: mkSessionId(r.sessionId),
    questionId: QuestionId(r.questionId),
    questionText: r.questionText,
    answer: r.answer,
    answeredAt: r.answeredAt,
  }));
}

function toRow(session: StandupSession) {
  return {
    id: session.id,
    configId: session.configId,
    memberId: session.memberId,
    date: session.date,
    status: session.status,
    currentQuestionIndex:
      session.status === "in_progress" ? session.currentQuestionIndex : null,
    deliveredAt:
      "deliveredAt" in session ? session.deliveredAt : null,
    completedAt:
      session.status === "completed" ? session.completedAt : null,
    skippedAt: session.status === "skipped" ? session.skippedAt : null,
    timedOutAt:
      session.status === "timed_out" ? session.timedOutAt : null,
    createdAt: session.createdAt,
  };
}

function toSession(
  row: typeof standupSessions.$inferSelect,
  responses: StandupResponse[]
): StandupSession {
  const base = {
    id: mkSessionId(row.id),
    configId: mkConfigId(row.configId),
    memberId: mkMemberId(row.memberId),
    date: row.date,
    createdAt: row.createdAt,
  };

  switch (row.status) {
    case "pending":
      return { ...base, status: "pending" };
    case "questions_delivered":
      return {
        ...base,
        status: "questions_delivered",
        deliveredAt: row.deliveredAt!,
      };
    case "in_progress":
      return {
        ...base,
        status: "in_progress",
        deliveredAt: row.deliveredAt!,
        currentQuestionIndex: row.currentQuestionIndex ?? 0,
        responses,
      };
    case "completed":
      return {
        ...base,
        status: "completed",
        deliveredAt: row.deliveredAt!,
        completedAt: row.completedAt!,
        responses,
      };
    case "skipped":
      return {
        ...base,
        status: "skipped",
        skippedAt: row.skippedAt!,
      };
    case "timed_out":
      return {
        ...base,
        status: "timed_out",
        deliveredAt: row.deliveredAt!,
        timedOutAt: row.timedOutAt!,
        responses,
      };
    default:
      throw new Error(`Unknown session status: ${row.status}`);
  }
}
