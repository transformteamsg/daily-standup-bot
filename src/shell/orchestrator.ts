import type {
  TeamRepository,
  MemberRepository,
  ConfigRepository,
  QuestionRepository,
  ConfigMemberRepository,
  SessionRepository,
  Messenger,
  Clock,
  IdGenerator,
  Logger,
  UserResolver,
} from "@/core/ports";
import type { StandupCommand } from "@/core/config/commands";
import type { StandupConfig } from "@/core/domain/standup";
import {
  TeamId,
  MemberId,
  ConfigId,
  QuestionId,
  SessionId,
  ResponseId,
} from "@/core/domain/standup";
import {
  createSession,
  markDelivered,
  startProgress,
  recordAnswer,
  timeoutSession,
  skipSession,
} from "@/core/standup/state-machine";
import { getCurrentQuestion, getMembersNeedingStandup, sortQuestionsByOrder } from "@/core/standup/questions";
import {
  formatFirstQuestionDM,
  formatQuestionDM,
  formatCompletedSummary,
  formatTimedOutSummary,
  formatSkippedSummary,
  formatStandupConfigSummary,
} from "@/core/standup/formatting";
import { shouldTrigger, isSessionExpired } from "@/core/standup/scheduling";
import { validateScheduleInput, validateTimeout, validateStandupName } from "@/core/config/validation";

export interface OrchestratorDeps {
  teamRepo: TeamRepository;
  memberRepo: MemberRepository;
  configRepo: ConfigRepository;
  questionRepo: QuestionRepository;
  configMemberRepo: ConfigMemberRepository;
  sessionRepo: SessionRepository;
  messenger: Messenger;
  clock: Clock;
  idGen: IdGenerator;
  logger: Logger;
  userResolver: UserResolver;
}

export interface Orchestrator {
  handleCommand(command: StandupCommand, slackTeamId: string, slackUserId: string): Promise<string>;
  handleAnswer(slackUserId: string, text: string): Promise<void>;
  triggerStandup(configId: string): Promise<void>;
  checkTimeouts(): Promise<void>;
  tick(): Promise<void>;
}

export function createOrchestrator(deps: OrchestratorDeps): Orchestrator {
  const {
    teamRepo, memberRepo, configRepo, questionRepo,
    configMemberRepo, sessionRepo,
    messenger, clock, idGen, logger, userResolver,
  } = deps;

  async function ensureTeam(slackTeamId: string) {
    let team = await teamRepo.findBySlackTeamId(slackTeamId);
    if (!team) {
      team = {
        id: TeamId(idGen.generate()),
        slackTeamId,
        name: slackTeamId,
        createdAt: clock.toISOString(),
      };
      await teamRepo.upsert(team);
    }
    return team;
  }

  async function ensureMember(teamId: ReturnType<typeof TeamId>, slackUserId: string) {
    let member = await memberRepo.findBySlackUserId(teamId, slackUserId);
    if (!member) {
      member = {
        id: MemberId(idGen.generate()),
        teamId,
        slackUserId,
        displayName: slackUserId,
        timezone: "UTC",
        createdAt: clock.toISOString(),
      };
      await memberRepo.upsert(member);
    }
    return member;
  }

  return {
    async handleCommand(command, slackTeamId, _slackUserId) {
      const team = await ensureTeam(slackTeamId);

      switch (command.type) {
        case "create": {
          const nameCheck = validateStandupName(command.name);
          if (!nameCheck.ok) return nameCheck.error;

          const existing = await configRepo.findByName(team.id, command.name);
          if (existing) return `A standup named "${command.name}" already exists.`;

          const channelCheck = await messenger.validateChannel(command.channelId);
          if (!channelCheck.ok) return channelCheck.error;

          const config: StandupConfig = {
            id: ConfigId(idGen.generate()),
            teamId: team.id,
            name: command.name,
            channelId: command.channelId,
            schedule: null,
            timeoutMinutes: 60,
            active: false,
            createdAt: clock.toISOString(),
          };
          await configRepo.save(config);
          return `Standup "${command.name}" created. Add questions and members, then activate it.`;
        }

        case "list": {
          const configs = await configRepo.findAll(team.id);
          if (configs.length === 0) return "No standups configured. Use `/tfx-standup create` to get started.";
          return configs
            .map((c) => `• *${c.name}* — ${c.active ? "Active" : "Inactive"} — <#${c.channelId}>`)
            .join("\n");
        }

        case "show": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const questions = await questionRepo.findByConfigId(config.id);
          const members = await configMemberRepo.findMembersByConfig(config.id);
          return formatStandupConfigSummary({
            name: config.name,
            channelId: config.channelId,
            active: config.active,
            schedule: config.schedule,
            timeoutMinutes: config.timeoutMinutes,
            questions: questions.map((q) => ({ text: q.text, order: q.order })),
            members: members.map((m) => ({ displayName: m.displayName })),
          });
        }

        case "schedule": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const result = validateScheduleInput(command.time, command.days, command.timezone);
          if (!result.ok) return result.error;
          await configRepo.update({ ...config, schedule: result.value });
          return `Schedule set for "${command.name}".`;
        }

        case "add-question": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const existing = await questionRepo.findByConfigId(config.id);
          const question = {
            id: QuestionId(idGen.generate()),
            configId: config.id,
            text: command.text,
            order: existing.length,
          };
          await questionRepo.save(question);
          return `Question added to "${command.name}" (${existing.length + 1} total).`;
        }

        case "remove-question": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const questions = sortQuestionsByOrder(await questionRepo.findByConfigId(config.id));
          const idx = command.questionNumber - 1;
          const target = questions[idx];
          if (!target) return `Question #${command.questionNumber} does not exist.`;
          await questionRepo.deleteById(target.id);
          const remaining = questions.filter((_, i) => i !== idx);
          for (let i = 0; i < remaining.length; i++) {
            await questionRepo.updateOrder(remaining[i]!.id, i);
          }
          return `Question #${command.questionNumber} removed from "${command.name}".`;
        }

        case "add-members": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const added: string[] = [];
          const unresolved: string[] = [];
          for (const userId of command.userIds) {
            if (/^[UW][A-Z0-9]+$/.test(userId)) {
              const member = await ensureMember(team.id, userId);
              await configMemberRepo.addMember(config.id, member.id);
              added.push(member.displayName);
            } else {
              const resolved = await userResolver.lookupByEmail(userId);
              if (!resolved) {
                unresolved.push(userId);
                continue;
              }
              let member = await ensureMember(team.id, resolved.slackUserId);
              if (member.displayName === member.slackUserId) {
                member = { ...member, displayName: resolved.displayName };
                await memberRepo.upsert(member);
              }
              await configMemberRepo.addMember(config.id, member.id);
              added.push(member.displayName);
            }
          }
          const lines: string[] = [];
          if (added.length > 0) {
            lines.push(`Added ${added.length} member(s) to "${command.name}": ${added.join(", ")}`);
          }
          if (unresolved.length > 0) {
            lines.push(`Could not resolve: ${unresolved.join(", ")}. Please use a valid Slack mention or email.`);
          }
          return lines.join("\n") || `No members added to "${command.name}".`;
        }

        case "remove-members": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          let removed = 0;
          for (const userId of command.userIds) {
            const member = await memberRepo.findBySlackUserId(team.id, userId);
            if (member) {
              await configMemberRepo.removeMember(config.id, member.id);
              removed++;
            }
          }
          return `Removed ${removed} member(s) from "${command.name}".`;
        }

        case "timeout": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const result = validateTimeout(command.minutes);
          if (!result.ok) return result.error;
          await configRepo.update({ ...config, timeoutMinutes: result.value });
          return `Timeout for "${command.name}" set to ${result.value} minutes.`;
        }

        case "activate": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          if (config.active) return `"${command.name}" is already active.`;
          await configRepo.update({ ...config, active: true });
          return `"${command.name}" activated.`;
        }

        case "deactivate": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          if (!config.active) return `"${command.name}" is already inactive.`;
          await configRepo.update({ ...config, active: false });
          return `"${command.name}" deactivated.`;
        }

        case "delete": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          await sessionRepo.deleteByConfigId(config.id);
          await questionRepo.deleteByConfigId(config.id);
          await configRepo.delete(config.id);
          return `"${command.name}" deleted.`;
        }

        case "help":
          return "Use /tfx-standup help for usage information.";
      }
    },

    async handleAnswer(slackUserId, text) {
      const member = await memberRepo.findBySlackUserIdGlobal(slackUserId);
      if (!member) {
        logger.info("No member found for DM reply", { slackUserId });
        return;
      }

      const session = await sessionRepo.findActiveByMember(member.id);
      if (!session) {
        logger.info("No active session for DM reply", { slackUserId });
        return;
      }

      if (text.toLowerCase().trim() === "skip") {
        const result = skipSession(session, clock.toISOString());
        if (!result.ok) return;
        await sessionRepo.update(result.session);
        const config = await configRepo.findById(session.configId);
        if (config) {
          try {
            await messenger.postToChannel(
              config.channelId,
              formatSkippedSummary(member.displayName)
            );
          } catch (err) {
            logger.error("Failed to post skip summary to channel", {
              channelId: config.channelId,
              config: config.name,
              error: String(err),
            });
          }
        }
        await messenger.sendDM(slackUserId, "Standup skipped.");
        return;
      }

      // Transition to in_progress if needed
      let activeSession = session;
      if (session.status === "questions_delivered") {
        const progressResult = startProgress(session);
        if (!progressResult.ok) return;
        activeSession = progressResult.session;
        await sessionRepo.update(activeSession);
      }

      if (activeSession.status !== "in_progress") return;

      const config = await configRepo.findById(activeSession.configId);
      if (!config) return;

      const questions = sortQuestionsByOrder(
        await questionRepo.findByConfigId(activeSession.configId)
      );
      const currentQuestion = getCurrentQuestion(activeSession, questions);
      if (!currentQuestion) return;

      const answerResult = recordAnswer(
        activeSession,
        currentQuestion,
        text,
        ResponseId(idGen.generate()),
        clock.toISOString(),
        questions.length
      );

      if (!answerResult.ok) return;
      await sessionRepo.update(answerResult.session);

      if (answerResult.session.status === "completed") {
        await messenger.sendDM(slackUserId, "Thanks! Your standup is complete.");
        try {
          await messenger.postToChannel(
            config.channelId,
            formatCompletedSummary(member.displayName, answerResult.session.responses)
          );
        } catch (err) {
          logger.error("Failed to post completed summary to channel", {
            channelId: config.channelId,
            config: config.name,
            error: String(err),
          });
        }
      } else if (answerResult.session.status === "in_progress") {
        const nextQ = getCurrentQuestion(answerResult.session, questions);
        if (nextQ) {
          await messenger.sendDM(
            slackUserId,
            formatQuestionDM(nextQ, answerResult.session.currentQuestionIndex + 1, questions.length)
          );
        }
      }
    },

    async triggerStandup(configId) {
      const config = await configRepo.findById(ConfigId(configId));
      if (!config || !config.active) return;

      const questions = sortQuestionsByOrder(
        await questionRepo.findByConfigId(config.id)
      );
      if (questions.length === 0) {
        logger.warn("No questions configured", { configId });
        return;
      }

      const allMembers = await configMemberRepo.findMembersByConfig(config.id);
      const today = clock.todayDateString();
      const existingSessions = await sessionRepo.findByConfigAndDate(config.id, today);
      const existingMemberIds = new Set(existingSessions.map((s) => s.memberId as string));
      const needsStandup = getMembersNeedingStandup(allMembers, existingMemberIds);

      for (const m of needsStandup) {
        try {
          const now = clock.toISOString();
          const session = createSession(
            SessionId(idGen.generate()),
            config.id,
            m.id,
            today,
            now
          );
          await sessionRepo.save(session);

          const deliveredResult = markDelivered(session, now);
          if (!deliveredResult.ok) continue;
          await sessionRepo.update(deliveredResult.session);

          const firstQ = questions[0]!;
          await messenger.sendDM(
            m.slackUserId,
            formatFirstQuestionDM(config.name, firstQ, questions.length)
          );
          logger.info("Sent standup DM", { member: m.slackUserId, config: config.name });
        } catch (err) {
          logger.error("Failed to trigger standup for member", {
            member: m.slackUserId,
            memberId: m.id,
            config: config.name,
            error: String(err),
          });
        }
      }
    },

    async checkTimeouts() {
      const now = clock.now();
      const expiredCandidates = await sessionRepo.findExpiredSessions(clock.toISOString());

      for (const session of expiredCandidates) {
        try {
          const config = await configRepo.findById(session.configId);
          if (!config) continue;

          if (
            session.status !== "questions_delivered" &&
            session.status !== "in_progress"
          ) continue;

          if (!isSessionExpired(session.deliveredAt, config.timeoutMinutes, now)) continue;

          const result = timeoutSession(session, clock.toISOString());
          if (!result.ok) continue;
          await sessionRepo.update(result.session);

          const m = await memberRepo.findById(session.memberId);
          if (!m) continue;

          const questions = sortQuestionsByOrder(
            await questionRepo.findByConfigId(session.configId)
          );

          try {
            await messenger.postToChannel(
              config.channelId,
              formatTimedOutSummary(m.displayName, result.session, questions)
            );
          } catch (err) {
            logger.error("Failed to post timeout summary to channel", {
              channelId: config.channelId,
              config: config.name,
              error: String(err),
            });
          }
          await messenger.sendDM(m.slackUserId, "Your standup has timed out.");
          logger.info("Session timed out", { session: session.id, member: m.slackUserId });
        } catch (err) {
          logger.error("Failed to check timeout for session", {
            sessionId: session.id,
            configId: session.configId,
            memberId: session.memberId,
            error: String(err),
          });
        }
      }
    },

    async tick() {
      const now = clock.now();
      const activeConfigs = await configRepo.findAllActive();

      for (const config of activeConfigs) {
        try {
          if (config.schedule && shouldTrigger(config.schedule, now)) {
            await this.triggerStandup(config.id);
          }
        } catch (err) {
          logger.error("Failed to trigger standup in tick", {
            config: config.name,
            configId: config.id,
            error: String(err),
          });
        }
      }

      try {
        await this.checkTimeouts();
      } catch (err) {
        logger.error("Failed to check timeouts in tick", {
          error: String(err),
        });
      }
    },
  };
}
