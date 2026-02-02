import type {
  PendingSession,
  QuestionsDeliveredSession,
  InProgressSession,
  CompletedSession,
  SkippedSession,
  TimedOutSession,
  StandupSession,
  TransitionResult,
  StandupResponse,
  StandupQuestion,
  SessionId,
  ConfigId,
  MemberId,
  ResponseId,
} from "@/core/domain/standup";

// --- Session Creation ---

export function createSession(
  id: SessionId,
  configId: ConfigId,
  memberId: MemberId,
  date: string,
  now: string
): PendingSession {
  return {
    id,
    configId,
    memberId,
    date,
    status: "pending",
    createdAt: now,
  };
}

// --- State Transitions ---

export function markDelivered(
  session: PendingSession,
  now: string
): TransitionResult<QuestionsDeliveredSession> {
  return {
    ok: true,
    session: {
      id: session.id,
      configId: session.configId,
      memberId: session.memberId,
      date: session.date,
      createdAt: session.createdAt,
      status: "questions_delivered",
      deliveredAt: now,
    },
  };
}

export function startProgress(
  session: QuestionsDeliveredSession
): TransitionResult<InProgressSession> {
  return {
    ok: true,
    session: {
      id: session.id,
      configId: session.configId,
      memberId: session.memberId,
      date: session.date,
      createdAt: session.createdAt,
      status: "in_progress",
      deliveredAt: session.deliveredAt,
      currentQuestionIndex: 0,
      responses: [],
    },
  };
}

export function recordAnswer(
  session: InProgressSession,
  question: StandupQuestion,
  answer: string,
  responseId: ResponseId,
  now: string,
  totalQuestions: number
): TransitionResult<InProgressSession | CompletedSession> {
  const response: StandupResponse = {
    id: responseId,
    sessionId: session.id,
    questionId: question.id,
    questionText: question.text,
    answer,
    answeredAt: now,
  };

  const newResponses = [...session.responses, response];
  const nextIndex = session.currentQuestionIndex + 1;

  if (nextIndex >= totalQuestions) {
    // All questions answered → completed
    return {
      ok: true,
      session: {
        id: session.id,
        configId: session.configId,
        memberId: session.memberId,
        date: session.date,
        createdAt: session.createdAt,
        status: "completed",
        deliveredAt: session.deliveredAt,
        completedAt: now,
        responses: newResponses,
      },
    };
  }

  // More questions remain
  return {
    ok: true,
    session: {
      id: session.id,
      configId: session.configId,
      memberId: session.memberId,
      date: session.date,
      createdAt: session.createdAt,
      status: "in_progress",
      deliveredAt: session.deliveredAt,
      currentQuestionIndex: nextIndex,
      responses: newResponses,
    },
  };
}

export function skipSession(
  session: StandupSession,
  now: string
): TransitionResult<SkippedSession> {
  if (session.status === "completed" || session.status === "timed_out") {
    return { ok: false, error: `Cannot skip a ${session.status} session` };
  }
  return {
    ok: true,
    session: {
      id: session.id,
      configId: session.configId,
      memberId: session.memberId,
      date: session.date,
      createdAt: session.createdAt,
      status: "skipped",
      skippedAt: now,
    },
  };
}

export function timeoutSession(
  session: StandupSession,
  now: string
): TransitionResult<TimedOutSession> {
  if (
    session.status !== "questions_delivered" &&
    session.status !== "in_progress"
  ) {
    return {
      ok: false,
      error: `Cannot timeout a ${session.status} session`,
    };
  }
  const responses =
    session.status === "in_progress" ? session.responses : [];
  return {
    ok: true,
    session: {
      id: session.id,
      configId: session.configId,
      memberId: session.memberId,
      date: session.date,
      createdAt: session.createdAt,
      status: "timed_out",
      deliveredAt: session.deliveredAt,
      timedOutAt: now,
      responses,
    },
  };
}
