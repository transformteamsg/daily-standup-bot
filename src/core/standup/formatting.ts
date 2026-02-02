import type {
  TimedOutSession,
  StandupResponse,
  StandupQuestion,
} from "@/core/domain/standup";

export function formatQuestionDM(
  question: StandupQuestion,
  questionNumber: number,
  totalQuestions: number
): string {
  return `*Question ${questionNumber}/${totalQuestions}:*\n${question.text}`;
}

export function formatFirstQuestionDM(
  standupName: string,
  question: StandupQuestion,
  totalQuestions: number
): string {
  return (
    `It's time for *${standupName}*! I'll ask you ${totalQuestions} question${totalQuestions === 1 ? "" : "s"}. Reply to each one.\n\n` +
    formatQuestionDM(question, 1, totalQuestions)
  );
}

export function formatCompletedSummary(
  displayName: string,
  responses: readonly StandupResponse[]
): string {
  const lines = responses.map(
    (r) => `*${r.questionText}*\n${r.answer}`
  );
  return `*${displayName}* has completed their standup:\n\n${lines.join("\n\n")}`;
}

export function formatTimedOutSummary(
  displayName: string,
  session: TimedOutSession,
  allQuestions: readonly StandupQuestion[]
): string {
  if (session.responses.length === 0) {
    return `*${displayName}* did not respond to the standup (timed out).`;
  }

  const answeredLines = session.responses.map(
    (r) => `*${r.questionText}*\n${r.answer}`
  );
  const answeredIds = new Set(session.responses.map((r) => r.questionId));
  const unanswered = allQuestions.filter((q) => !answeredIds.has(q.id));
  const unansweredLines = unanswered.map(
    (q) => `*${q.text}*\n_No response (timed out)_`
  );

  return (
    `*${displayName}* partially completed their standup (timed out):\n\n` +
    [...answeredLines, ...unansweredLines].join("\n\n")
  );
}

export function formatSkippedSummary(displayName: string): string {
  return `*${displayName}* skipped the standup.`;
}

export function formatStandupConfigSummary(config: {
  name: string;
  channelId: string;
  active: boolean;
  schedule: { hour: number; minute: number; days: readonly number[]; timezone: string } | null;
  timeoutMinutes: number;
  questions: readonly { text: string; order: number }[];
  members: readonly { displayName: string }[];
}): string {
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const scheduleStr = config.schedule
    ? `${String(config.schedule.hour).padStart(2, "0")}:${String(config.schedule.minute).padStart(2, "0")} on ${config.schedule.days.map((d) => dayNames[d]).join(", ")} (${config.schedule.timezone})`
    : "Not set";

  const questionsStr = config.questions.length > 0
    ? [...config.questions]
        .sort((a, b) => a.order - b.order)
        .map((q, i) => `  ${i + 1}. ${q.text}`)
        .join("\n")
    : "  None";

  const membersStr = config.members.length > 0
    ? config.members.map((m) => m.displayName).join(", ")
    : "None";

  return [
    `*${config.name}*`,
    `Status: ${config.active ? "Active" : "Inactive"}`,
    `Channel: <#${config.channelId}>`,
    `Schedule: ${scheduleStr}`,
    `Timeout: ${config.timeoutMinutes} minutes`,
    `Questions:\n${questionsStr}`,
    `Members: ${membersStr}`,
  ].join("\n");
}

export function formatHelpMessage(): string {
  return [
    "*Standup Bot Commands*",
    "",
    "`/tfx-standup create <name> <#channel>` — Create a new standup",
    "`/tfx-standup list` — List all standups",
    "`/tfx-standup show <name>` — Show standup details",
    "`/tfx-standup schedule <name> <HH:MM> <days> <timezone>` — Set schedule",
    "  _days: mon,tue,wed,thu,fri or weekdays or everyday_",
    "`/tfx-standup add-question <name> <text>` — Add a question",
    "`/tfx-standup remove-question <name> <#>` — Remove a question by number",
    "`/tfx-standup add-members <name> @user1 @user2` — Add members",
    "`/tfx-standup remove-members <name> @user1 @user2` — Remove members",
    "`/tfx-standup timeout <name> <minutes>` — Set timeout (5-480)",
    "`/tfx-standup activate <name>` — Activate a standup",
    "`/tfx-standup deactivate <name>` — Deactivate a standup",
    "`/tfx-standup delete <name>` — Delete a standup",
    "`/tfx-standup help` — Show this help message",
  ].join("\n");
}
