// Branded ID types for type safety
export type TeamId = string & { readonly __brand: "TeamId" };
export type MemberId = string & { readonly __brand: "MemberId" };
export type ConfigId = string & { readonly __brand: "ConfigId" };
export type QuestionId = string & { readonly __brand: "QuestionId" };
export type SessionId = string & { readonly __brand: "SessionId" };
export type ResponseId = string & { readonly __brand: "ResponseId" };
export type AdminId = string & { readonly __brand: "AdminId" };
export type DailyThreadId = string & { readonly __brand: "DailyThreadId" };

// Constructors
export const TeamId = (id: string): TeamId => id as TeamId;
export const MemberId = (id: string): MemberId => id as MemberId;
export const ConfigId = (id: string): ConfigId => id as ConfigId;
export const QuestionId = (id: string): QuestionId => id as QuestionId;
export const SessionId = (id: string): SessionId => id as SessionId;
export const ResponseId = (id: string): ResponseId => id as ResponseId;
export const AdminId = (id: string): AdminId => id as AdminId;
export const DailyThreadId = (id: string): DailyThreadId => id as DailyThreadId;

// Domain entities
export interface Team {
  readonly id: TeamId;
  readonly slackTeamId: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface Member {
  readonly id: MemberId;
  readonly teamId: TeamId;
  readonly slackUserId: string;
  readonly displayName: string;
  readonly timezone: string;
  readonly createdAt: string;
}

export interface StandupQuestion {
  readonly id: QuestionId;
  readonly configId: ConfigId;
  readonly text: string;
  readonly order: number;
}

export interface Schedule {
  readonly hour: number;
  readonly minute: number;
  readonly days: readonly number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  readonly timezone: string;
}

export interface StandupConfig {
  readonly id: ConfigId;
  readonly teamId: TeamId;
  readonly name: string;
  readonly channelId: string;
  readonly schedule: Schedule | null;
  readonly timeoutMinutes: number;
  readonly active: boolean;
  readonly createdAt: string;
}

export interface StandupResponse {
  readonly id: ResponseId;
  readonly sessionId: SessionId;
  readonly questionId: QuestionId;
  readonly questionText: string;
  readonly answer: string;
  readonly answeredAt: string;
}

// --- Standup Session State Machine (discriminated union on status) ---

export type SessionStatus =
  | "pending"
  | "questions_delivered"
  | "in_progress"
  | "completed"
  | "skipped"
  | "timed_out";

interface SessionBase {
  readonly id: SessionId;
  readonly configId: ConfigId;
  readonly memberId: MemberId;
  readonly date: string; // YYYY-MM-DD
  readonly createdAt: string;
}

export interface PendingSession extends SessionBase {
  readonly status: "pending";
}

export interface QuestionsDeliveredSession extends SessionBase {
  readonly status: "questions_delivered";
  readonly deliveredAt: string;
}

export interface InProgressSession extends SessionBase {
  readonly status: "in_progress";
  readonly deliveredAt: string;
  readonly currentQuestionIndex: number;
  readonly responses: readonly StandupResponse[];
}

export interface CompletedSession extends SessionBase {
  readonly status: "completed";
  readonly deliveredAt: string;
  readonly completedAt: string;
  readonly responses: readonly StandupResponse[];
}

export interface SkippedSession extends SessionBase {
  readonly status: "skipped";
  readonly skippedAt: string;
}

export interface TimedOutSession extends SessionBase {
  readonly status: "timed_out";
  readonly deliveredAt: string;
  readonly timedOutAt: string;
  readonly responses: readonly StandupResponse[];
}

export type StandupSession =
  | PendingSession
  | QuestionsDeliveredSession
  | InProgressSession
  | CompletedSession
  | SkippedSession
  | TimedOutSession;

// Transition result
export type TransitionResult<T> =
  | { readonly ok: true; readonly session: T }
  | { readonly ok: false; readonly error: string };

// Admin entity
export interface Admin {
  readonly id: AdminId;
  readonly teamId: TeamId;
  readonly slackUserId: string;
  readonly createdAt: string;
}

// Daily thread entity
export interface DailyThread {
  readonly id: DailyThreadId;
  readonly configId: ConfigId;
  readonly date: string; // YYYY-MM-DD
  readonly channelId: string;
  readonly threadTs: string;
  readonly createdAt: string;
}

// Report subscription entity
export interface ReportSubscription {
  readonly configId: ConfigId;
  readonly subscriberSlackUserId: string;
  readonly targetMemberId: MemberId;
  readonly createdAt: string;
}
