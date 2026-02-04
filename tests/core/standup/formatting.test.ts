import { describe, it, expect } from "vitest";
import {
  formatQuestionDM,
  formatFirstQuestionDM,
  formatCompletedSummary,
  formatTimedOutSummary,
  formatSkippedSummary,
  formatStandupConfigSummary,
  formatHelpMessage,
  formatSchedule,
} from "@/core/standup/formatting";
import {
  ConfigId,
  QuestionId,
  ResponseId,
  SessionId,
  MemberId,
} from "@/core/domain/standup";
import type {
  StandupQuestion,
  StandupResponse,
  TimedOutSession,
} from "@/core/domain/standup";

const cid = ConfigId("c1");
const sid = SessionId("s1");

const question: StandupQuestion = {
  id: QuestionId("q1"),
  configId: cid,
  text: "What did you do yesterday?",
  order: 0,
};

describe("formatQuestionDM", () => {
  it("formats a question with number and total", () => {
    const result = formatQuestionDM(question, 1, 3);
    expect(result).toBe("*Question 1/3:*\nWhat did you do yesterday?");
  });
});

describe("formatFirstQuestionDM", () => {
  it("includes standup name, question count, and channel reference", () => {
    const result = formatFirstQuestionDM("Morning Standup", question, 3, "C123");
    expect(result).toContain("Morning Standup");
    expect(result).toContain("3 questions");
    expect(result).toContain("What did you do yesterday?");
    expect(result).toContain("<#C123>");
  });

  it("uses singular for 1 question", () => {
    const result = formatFirstQuestionDM("Daily", question, 1, "C456");
    expect(result).toContain("1 question.");
    expect(result).not.toContain("questions");
  });
});

describe("formatCompletedSummary", () => {
  it("formats all responses with display name", () => {
    const responses: StandupResponse[] = [
      {
        id: ResponseId("r1"),
        sessionId: sid,
        questionId: QuestionId("q1"),
        questionText: "What did you do?",
        answer: "Built features",
        answeredAt: "2025-01-06T09:01:00Z",
      },
      {
        id: ResponseId("r2"),
        sessionId: sid,
        questionId: QuestionId("q2"),
        questionText: "What will you do?",
        answer: "More features",
        answeredAt: "2025-01-06T09:02:00Z",
      },
    ];
    const result = formatCompletedSummary("Alice", responses, "Daily");
    expect(result).toContain("*Alice*");
    expect(result).toContain("*Daily*");
    expect(result).toContain("Built features");
    expect(result).toContain("More features");
    expect(result).toContain("*What did you do?*");
  });
});

describe("formatTimedOutSummary", () => {
  it("shows no-response message when zero answers", () => {
    const session: TimedOutSession = {
      id: sid,
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "timed_out",
      deliveredAt: "2025-01-06T09:00:01Z",
      timedOutAt: "2025-01-06T10:00:01Z",
      responses: [],
    };
    const result = formatTimedOutSummary("Bob", session, [question], "Daily");
    expect(result).toContain("did not respond");
    expect(result).toContain("Bob");
    expect(result).toContain("*Daily*");
  });

  it("shows partial answers with unanswered questions", () => {
    const q2: StandupQuestion = {
      id: QuestionId("q2"),
      configId: cid,
      text: "Any blockers?",
      order: 1,
    };
    const session: TimedOutSession = {
      id: sid,
      configId: cid,
      memberId: MemberId("m1"),
      date: "2025-01-06",
      createdAt: "2025-01-06T09:00:00Z",
      status: "timed_out",
      deliveredAt: "2025-01-06T09:00:01Z",
      timedOutAt: "2025-01-06T10:00:01Z",
      responses: [
        {
          id: ResponseId("r1"),
          sessionId: sid,
          questionId: QuestionId("q1"),
          questionText: "What did you do yesterday?",
          answer: "Stuff",
          answeredAt: "2025-01-06T09:01:00Z",
        },
      ],
    };
    const result = formatTimedOutSummary("Bob", session, [question, q2], "Daily");
    expect(result).toContain("partially completed");
    expect(result).toContain("*Daily*");
    expect(result).toContain("Stuff");
    expect(result).toContain("No response (timed out)");
  });
});

describe("formatSkippedSummary", () => {
  it("formats skipped message with standup name", () => {
    const result = formatSkippedSummary("Charlie", "Daily");
    expect(result).toContain("Charlie");
    expect(result).toContain("skipped");
    expect(result).toContain("*Daily*");
  });
});

describe("formatStandupConfigSummary", () => {
  it("formats full config summary", () => {
    const result = formatStandupConfigSummary({
      name: "Morning",
      channelId: "C123",
      active: true,
      schedule: { hour: 9, minute: 0, days: [1, 2, 3, 4, 5], timezone: "UTC" },
      timeoutMinutes: 60,
      questions: [
        { text: "Q1?", order: 0 },
        { text: "Q2?", order: 1 },
      ],
      members: [{ displayName: "Alice" }, { displayName: "Bob" }],
    });
    expect(result).toContain("*Morning*");
    expect(result).toContain("Active");
    expect(result).toContain("<#C123>");
    expect(result).toContain("09:00");
    expect(result).toContain("Mon, Tue, Wed, Thu, Fri");
    expect(result).toContain("60 minutes");
    expect(result).toContain("Q1?");
    expect(result).toContain("Alice, Bob");
  });

  it("shows inactive and no schedule", () => {
    const result = formatStandupConfigSummary({
      name: "Test",
      channelId: "C456",
      active: false,
      schedule: null,
      timeoutMinutes: 30,
      questions: [],
      members: [],
    });
    expect(result).toContain("Inactive");
    expect(result).toContain("Not set");
    expect(result).toContain("None");
  });
});

describe("formatSchedule", () => {
  it("formats schedule with time, days, and timezone", () => {
    const result = formatSchedule({ hour: 9, minute: 0, days: [1, 2, 3, 4, 5], timezone: "Asia/Singapore" });
    expect(result).toBe("09:00 on Mon, Tue, Wed, Thu, Fri (Asia/Singapore)");
  });

  it("pads single-digit hours and minutes", () => {
    const result = formatSchedule({ hour: 8, minute: 5, days: [0, 6], timezone: "UTC" });
    expect(result).toBe("08:05 on Sun, Sat (UTC)");
  });
});

describe("formatHelpMessage", () => {
  it("includes all commands", () => {
    const result = formatHelpMessage();
    expect(result).toContain("tfx-standup create");
    expect(result).toContain("tfx-standup list");
    expect(result).toContain("tfx-standup schedule");
    expect(result).toContain("tfx-standup help");
  });
});
