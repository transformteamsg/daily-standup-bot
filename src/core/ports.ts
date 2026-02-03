import type {
  ConfigId,
  Member,
  MemberId,
  StandupConfig,
  StandupQuestion,
  StandupResponse,
  StandupSession,
  SessionId,
  TeamId,
  Team,
} from "@/core/domain/standup";

// --- Repository Ports (DB access) ---

export interface TeamRepository {
  findBySlackTeamId(slackTeamId: string): Promise<Team | null>;
  upsert(team: Team): Promise<void>;
}

export interface MemberRepository {
  findBySlackUserId(
    teamId: TeamId,
    slackUserId: string
  ): Promise<Member | null>;
  findBySlackUserIdGlobal(slackUserId: string): Promise<Member | null>;
  findById(id: MemberId): Promise<Member | null>;
  upsert(member: Member): Promise<void>;
}

export interface ConfigRepository {
  findById(id: ConfigId): Promise<StandupConfig | null>;
  findByName(teamId: TeamId, name: string): Promise<StandupConfig | null>;
  findActiveByTeam(teamId: TeamId): Promise<readonly StandupConfig[]>;
  findAllActive(): Promise<readonly StandupConfig[]>;
  findAll(teamId: TeamId): Promise<readonly StandupConfig[]>;
  save(config: StandupConfig): Promise<void>;
  update(config: StandupConfig): Promise<void>;
  delete(id: ConfigId): Promise<void>;
}

export interface QuestionRepository {
  findByConfigId(configId: ConfigId): Promise<readonly StandupQuestion[]>;
  save(question: StandupQuestion): Promise<void>;
  deleteById(id: string): Promise<void>;
  deleteByConfigId(configId: ConfigId): Promise<void>;
  updateOrder(id: string, order: number): Promise<void>;
}

export interface ConfigMemberRepository {
  findMembersByConfig(configId: ConfigId): Promise<readonly Member[]>;
  findConfigsByMember(memberId: MemberId): Promise<readonly StandupConfig[]>;
  addMember(configId: ConfigId, memberId: MemberId): Promise<void>;
  removeMember(configId: ConfigId, memberId: MemberId): Promise<void>;
}

export interface SessionRepository {
  findById(id: SessionId): Promise<StandupSession | null>;
  findByConfigAndDate(
    configId: ConfigId,
    date: string
  ): Promise<readonly StandupSession[]>;
  findByMemberAndDate(
    memberId: MemberId,
    date: string
  ): Promise<readonly StandupSession[]>;
  findActiveByMember(memberId: MemberId): Promise<StandupSession | null>;
  findExpiredSessions(
    beforeTime: string
  ): Promise<readonly StandupSession[]>;
  save(session: StandupSession): Promise<void>;
  update(session: StandupSession): Promise<void>;
}

export interface ResponseRepository {
  findBySessionId(sessionId: SessionId): Promise<readonly StandupResponse[]>;
  save(response: StandupResponse): Promise<void>;
}

// --- Adapter Ports (external services) ---

export interface Messenger {
  sendDM(slackUserId: string, text: string): Promise<void>;
  postToChannel(channelId: string, text: string): Promise<void>;
  validateChannel(channelId: string): Promise<{ ok: true } | { ok: false; error: string }>;
}

export interface Clock {
  now(): Date;
  todayDateString(): string; // YYYY-MM-DD
  toISOString(): string;
}

export interface IdGenerator {
  generate(): string;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface UserResolver {
  lookupByEmail(email: string): Promise<{ slackUserId: string; displayName: string } | null>;
}
