import { describe, it, expect } from "vitest";
import {
  getCurrentQuestion,
  getNextQuestion,
  getMembersNeedingStandup,
  sortQuestionsByOrder,
} from "@/core/standup/questions";
import {
  ConfigId,
  MemberId,
  QuestionId,
  SessionId,
  TeamId,
} from "@/core/domain/standup";
import type {
  InProgressSession,
  QuestionsDeliveredSession,
  Member,
  StandupQuestion,
} from "@/core/domain/standup";

const cid = ConfigId("c1");
const qid1 = QuestionId("q1");
const qid2 = QuestionId("q2");
const qid3 = QuestionId("q3");

const questions: StandupQuestion[] = [
  { id: qid1, configId: cid, text: "Q1?", order: 0 },
  { id: qid2, configId: cid, text: "Q2?", order: 1 },
  { id: qid3, configId: cid, text: "Q3?", order: 2 },
];

describe("getCurrentQuestion", () => {
  it("returns first question for questions_delivered session", () => {
    const delivered: QuestionsDeliveredSession = {
      id: SessionId("s1"),
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "questions_delivered",
      deliveredAt: "2025-01-06T09:00:01Z",
    };
    const q = getCurrentQuestion(delivered, questions);
    expect(q?.text).toBe("Q1?");
  });

  it("returns current question for in_progress session", () => {
    const inProgress: InProgressSession = {
      id: SessionId("s1"),
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "in_progress",
      deliveredAt: "2025-01-06T09:00:01Z",
      currentQuestionIndex: 1,
      responses: [],
    };
    const q = getCurrentQuestion(inProgress, questions);
    expect(q?.text).toBe("Q2?");
  });

  it("returns null if index out of bounds", () => {
    const inProgress: InProgressSession = {
      id: SessionId("s1"),
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "in_progress",
      deliveredAt: "2025-01-06T09:00:01Z",
      currentQuestionIndex: 5,
      responses: [],
    };
    const q = getCurrentQuestion(inProgress, questions);
    expect(q).toBeNull();
  });
});

describe("getNextQuestion", () => {
  it("returns next question when available", () => {
    const inProgress: InProgressSession = {
      id: SessionId("s1"),
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "in_progress",
      deliveredAt: "2025-01-06T09:00:01Z",
      currentQuestionIndex: 0,
      responses: [],
    };
    const q = getNextQuestion(inProgress, questions);
    expect(q?.text).toBe("Q2?");
  });

  it("returns null when at last question", () => {
    const inProgress: InProgressSession = {
      id: SessionId("s1"),
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "in_progress",
      deliveredAt: "2025-01-06T09:00:01Z",
      currentQuestionIndex: 2,
      responses: [],
    };
    const q = getNextQuestion(inProgress, questions);
    expect(q).toBeNull();
  });
});

describe("getMembersNeedingStandup", () => {
  const members: Member[] = [
    {
      id: MemberId("m1"),
      teamId: TeamId("t1"),
      slackUserId: "U001",
      displayName: "Alice",
      timezone: "UTC",
      createdAt: "2025-01-01",
    },
    {
      id: MemberId("m2"),
      teamId: TeamId("t1"),
      slackUserId: "U002",
      displayName: "Bob",
      timezone: "UTC",
      createdAt: "2025-01-01",
    },
    {
      id: MemberId("m3"),
      teamId: TeamId("t1"),
      slackUserId: "U003",
      displayName: "Charlie",
      timezone: "UTC",
      createdAt: "2025-01-01",
    },
  ];

  it("returns all members when no existing sessions", () => {
    const result = getMembersNeedingStandup(members, new Set());
    expect(result).toHaveLength(3);
  });

  it("excludes members with existing sessions", () => {
    const existing = new Set(["m1", "m3"]);
    const result = getMembersNeedingStandup(members, existing);
    expect(result).toHaveLength(1);
    expect(result[0]!.displayName).toBe("Bob");
  });

  it("returns empty when all members have sessions", () => {
    const existing = new Set(["m1", "m2", "m3"]);
    const result = getMembersNeedingStandup(members, existing);
    expect(result).toHaveLength(0);
  });
});

describe("sortQuestionsByOrder", () => {
  it("sorts questions by order field", () => {
    const unordered: StandupQuestion[] = [
      { id: qid3, configId: cid, text: "Q3?", order: 2 },
      { id: qid1, configId: cid, text: "Q1?", order: 0 },
      { id: qid2, configId: cid, text: "Q2?", order: 1 },
    ];
    const sorted = sortQuestionsByOrder(unordered);
    expect(sorted.map((q) => q.text)).toEqual(["Q1?", "Q2?", "Q3?"]);
  });

  it("does not mutate the input", () => {
    const original: StandupQuestion[] = [
      { id: qid2, configId: cid, text: "Q2?", order: 1 },
      { id: qid1, configId: cid, text: "Q1?", order: 0 },
    ];
    sortQuestionsByOrder(original);
    expect(original[0]!.text).toBe("Q2?");
  });
});
