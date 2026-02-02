import { describe, it, expect } from "vitest";
import {
  createSession,
  markDelivered,
  startProgress,
  recordAnswer,
  skipSession,
  timeoutSession,
} from "@/core/standup/state-machine";
import {
  SessionId,
  ConfigId,
  MemberId,
  QuestionId,
  ResponseId,
} from "@/core/domain/standup";
import type {
  QuestionsDeliveredSession,
  InProgressSession,
  CompletedSession,
  StandupQuestion,
} from "@/core/domain/standup";

const sid = SessionId("s1");
const cid = ConfigId("c1");
const mid = MemberId("m1");
const qid1 = QuestionId("q1");
const qid2 = QuestionId("q2");
const rid = ResponseId("r1");

const question1: StandupQuestion = {
  id: qid1,
  configId: cid,
  text: "What did you do yesterday?",
  order: 0,
};

const question2: StandupQuestion = {
  id: qid2,
  configId: cid,
  text: "What will you do today?",
  order: 1,
};

describe("createSession", () => {
  it("creates a pending session", () => {
    const session = createSession(sid, cid, mid, "2025-01-06", "2025-01-06T09:00:00Z");
    expect(session.status).toBe("pending");
    expect(session.id).toBe(sid);
    expect(session.configId).toBe(cid);
    expect(session.memberId).toBe(mid);
    expect(session.date).toBe("2025-01-06");
  });
});

describe("markDelivered", () => {
  it("transitions pending → questions_delivered", () => {
    const pending = createSession(sid, cid, mid, "2025-01-06", "2025-01-06T09:00:00Z");
    const result = markDelivered(pending, "2025-01-06T09:00:01Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("questions_delivered");
      expect(result.session.deliveredAt).toBe("2025-01-06T09:00:01Z");
    }
  });
});

describe("startProgress", () => {
  it("transitions questions_delivered → in_progress", () => {
    const delivered: QuestionsDeliveredSession = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "questions_delivered",
      deliveredAt: "2025-01-06T09:00:01Z",
    };
    const result = startProgress(delivered);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("in_progress");
      expect(result.session.currentQuestionIndex).toBe(0);
      expect(result.session.responses).toEqual([]);
    }
  });
});

describe("recordAnswer", () => {
  const inProgress: InProgressSession = {
    id: sid,
    configId: cid,
    memberId: mid,
    date: "2025-01-06",
    createdAt: "2025-01-06T09:00:00Z",
    status: "in_progress",
    deliveredAt: "2025-01-06T09:00:01Z",
    currentQuestionIndex: 0,
    responses: [],
  };

  it("stays in_progress when more questions remain", () => {
    const result = recordAnswer(
      inProgress,
      question1,
      "Did stuff",
      rid,
      "2025-01-06T09:01:00Z",
      2
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("in_progress");
      const s = result.session as InProgressSession;
      expect(s.currentQuestionIndex).toBe(1);
      expect(s.responses).toHaveLength(1);
      expect(s.responses[0]!.answer).toBe("Did stuff");
    }
  });

  it("transitions to completed on last answer", () => {
    const result = recordAnswer(
      inProgress,
      question1,
      "Did stuff",
      rid,
      "2025-01-06T09:01:00Z",
      1 // only 1 question total
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("completed");
      const s = result.session as CompletedSession;
      expect(s.completedAt).toBe("2025-01-06T09:01:00Z");
      expect(s.responses).toHaveLength(1);
    }
  });

  it("preserves previous responses", () => {
    const withOneAnswer: InProgressSession = {
      ...inProgress,
      currentQuestionIndex: 1,
      responses: [
        {
          id: ResponseId("r0"),
          sessionId: sid,
          questionId: qid1,
          questionText: question1.text,
          answer: "First answer",
          answeredAt: "2025-01-06T09:01:00Z",
        },
      ],
    };
    const result = recordAnswer(
      withOneAnswer,
      question2,
      "Second answer",
      rid,
      "2025-01-06T09:02:00Z",
      2
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("completed");
      const s = result.session as CompletedSession;
      expect(s.responses).toHaveLength(2);
    }
  });
});

describe("skipSession", () => {
  it("skips a pending session", () => {
    const pending = createSession(sid, cid, mid, "2025-01-06", "2025-01-06T09:00:00Z");
    const result = skipSession(pending, "2025-01-06T09:05:00Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("skipped");
      expect(result.session.skippedAt).toBe("2025-01-06T09:05:00Z");
    }
  });

  it("skips an in_progress session", () => {
    const inProgress: InProgressSession = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "in_progress",
      deliveredAt: "2025-01-06T09:00:01Z",
      currentQuestionIndex: 0,
      responses: [],
    };
    const result = skipSession(inProgress, "2025-01-06T09:05:00Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("skipped");
    }
  });

  it("rejects skipping a completed session", () => {
    const completed: CompletedSession = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "completed",
      deliveredAt: "2025-01-06T09:00:01Z",
      completedAt: "2025-01-06T09:05:00Z",
      responses: [],
    };
    const result = skipSession(completed, "2025-01-06T09:06:00Z");
    expect(result.ok).toBe(false);
  });

  it("rejects skipping a timed_out session", () => {
    const timedOut = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "timed_out" as const,
      deliveredAt: "2025-01-06T09:00:01Z",
      timedOutAt: "2025-01-06T10:00:01Z",
      responses: [],
    };
    const result = skipSession(timedOut, "2025-01-06T10:05:00Z");
    expect(result.ok).toBe(false);
  });
});

describe("timeoutSession", () => {
  it("times out a questions_delivered session", () => {
    const delivered: QuestionsDeliveredSession = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "questions_delivered",
      deliveredAt: "2025-01-06T09:00:01Z",
    };
    const result = timeoutSession(delivered, "2025-01-06T10:00:01Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("timed_out");
      expect(result.session.responses).toEqual([]);
    }
  });

  it("times out an in_progress session preserving responses", () => {
    const inProgress: InProgressSession = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "in_progress",
      deliveredAt: "2025-01-06T09:00:01Z",
      currentQuestionIndex: 1,
      responses: [
        {
          id: ResponseId("r0"),
          sessionId: sid,
          questionId: qid1,
          questionText: "Q1",
          answer: "A1",
          answeredAt: "2025-01-06T09:01:00Z",
        },
      ],
    };
    const result = timeoutSession(inProgress, "2025-01-06T10:00:01Z");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.status).toBe("timed_out");
      expect(result.session.responses).toHaveLength(1);
    }
  });

  it("rejects timing out a pending session", () => {
    const pending = createSession(sid, cid, mid, "2025-01-06", "2025-01-06T09:00:00Z");
    const result = timeoutSession(pending, "2025-01-06T10:00:01Z");
    expect(result.ok).toBe(false);
  });

  it("rejects timing out a completed session", () => {
    const completed: CompletedSession = {
      id: sid,
      configId: cid,
      memberId: mid,
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "completed",
      deliveredAt: "2025-01-06T09:00:01Z",
      completedAt: "2025-01-06T09:05:00Z",
      responses: [],
    };
    const result = timeoutSession(completed, "2025-01-06T10:00:01Z");
    expect(result.ok).toBe(false);
  });
});
