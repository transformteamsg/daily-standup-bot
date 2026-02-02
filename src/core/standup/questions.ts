import type {
  StandupQuestion,
  InProgressSession,
  QuestionsDeliveredSession,
  Member,
} from "@/core/domain/standup";

export function getCurrentQuestion(
  session: InProgressSession | QuestionsDeliveredSession,
  questions: readonly StandupQuestion[]
): StandupQuestion | null {
  const index =
    session.status === "in_progress" ? session.currentQuestionIndex : 0;
  return questions[index] ?? null;
}

export function getNextQuestion(
  session: InProgressSession,
  questions: readonly StandupQuestion[]
): StandupQuestion | null {
  const nextIndex = session.currentQuestionIndex + 1;
  return questions[nextIndex] ?? null;
}

export function getMembersNeedingStandup(
  allMembers: readonly Member[],
  existingSessionMemberIds: ReadonlySet<string>
): readonly Member[] {
  return allMembers.filter((m) => !existingSessionMemberIds.has(m.id));
}

export function sortQuestionsByOrder(
  questions: readonly StandupQuestion[]
): readonly StandupQuestion[] {
  return [...questions].sort((a, b) => a.order - b.order);
}
