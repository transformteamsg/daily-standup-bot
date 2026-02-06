import type {
  TeamRepository,
  MemberRepository,
  ConfigRepository,
  QuestionRepository,
  ConfigMemberRepository,
  SessionRepository,
  AdminRepository,
  DailyThreadRepository,
  ReportSubscriptionRepository,
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
  AdminId,
  DailyThreadId,
} from "@/core/domain/standup";
import { formatDateForThread } from "@/core/standup/formatting";
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
  formatSchedule,
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
  adminRepo: AdminRepository;
  dailyThreadRepo: DailyThreadRepository;
  subscriptionRepo: ReportSubscriptionRepository;
  messenger: Messenger;
  clock: Clock;
  idGen: IdGenerator;
  logger: Logger;
  userResolver: UserResolver;
  superadminUserId: string;
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
    configMemberRepo, sessionRepo, adminRepo, dailyThreadRepo, subscriptionRepo,
    messenger, clock, idGen, logger, userResolver, superadminUserId,
  } = deps;

  const sentReports = new Set<string>();

  function isSuperadmin(slackUserId: string): boolean {
    return slackUserId === superadminUserId;
  }

  async function isAuthorized(slackUserId: string, teamId: ReturnType<typeof TeamId>): Promise<boolean> {
    if (isSuperadmin(slackUserId)) return true;
    const admin = await adminRepo.findByTeamAndSlackUserId(teamId, slackUserId);
    return admin !== null;
  }

  async function getOrCreateDailyThread(config: StandupConfig, date: string): Promise<string> {
    const existing = await dailyThreadRepo.findByConfigAndDate(config.id, date);
    if (existing) return existing.threadTs;

    const headerText = `*${config.name}* — ${formatDateForThread(date)}`;
    const threadTs = await messenger.postToChannelWithTs(config.channelId, headerText);

    const thread = {
      id: DailyThreadId(idGen.generate()),
      configId: config.id,
      date,
      channelId: config.channelId,
      threadTs,
      createdAt: clock.toISOString(),
    };
    await dailyThreadRepo.save(thread);
    return threadTs;
  }

  async function checkAggregatedReports(configId: ReturnType<typeof ConfigId>, date: string): Promise<void> {
    const allSubs = await subscriptionRepo.findSubscribersForConfig(configId);
    if (allSubs.length === 0) return;

    // Group subscriptions by subscriber
    const bySubscriber = new Map<string, typeof allSubs[number][]>();
    for (const sub of allSubs) {
      const list = bySubscriber.get(sub.subscriberSlackUserId) ?? [];
      list.push(sub);
      bySubscriber.set(sub.subscriberSlackUserId, list);
    }

    const config = await configRepo.findById(configId);
    if (!config) return;

    const todaySessions = await sessionRepo.findByConfigAndDate(configId, date);

    for (const [subscriberUserId, subs] of bySubscriber) {
      const dedupKey = `${configId}:${subscriberUserId}:${date}`;
      if (sentReports.has(dedupKey)) continue;

      // Check if ALL target members have terminal sessions
      const allDone = subs.every((sub) => {
        const session = todaySessions.find((s) => s.memberId === sub.targetMemberId);
        return session && (session.status === "completed" || session.status === "skipped" || session.status === "timed_out");
      });

      if (!allDone) continue;

      // Build aggregated report
      const lines: string[] = [`*Aggregated Report — ${config.name}* (${formatDateForThread(date)})\n`];

      for (const sub of subs) {
        const session = todaySessions.find((s) => s.memberId === sub.targetMemberId);
        if (!session) continue;

        const member = await memberRepo.findById(sub.targetMemberId);
        if (!member) continue;

        if (session.status === "completed") {
          lines.push(formatCompletedSummary(member.displayName, session.responses, config.name));
        } else if (session.status === "skipped") {
          lines.push(formatSkippedSummary(member.displayName, config.name));
        } else if (session.status === "timed_out") {
          const questions = sortQuestionsByOrder(await questionRepo.findByConfigId(configId));
          lines.push(formatTimedOutSummary(member.displayName, session, questions, config.name));
        }
      }

      try {
        await messenger.sendDM(subscriberUserId, lines.join("\n\n"));
        sentReports.add(dedupKey);
      } catch (err) {
        logger.error("Failed to send aggregated report", {
          subscriber: subscriberUserId,
          config: config.name,
          error: String(err),
        });
      }
    }
  }

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
    async handleCommand(command, slackTeamId, slackUserId) {
      const team = await ensureTeam(slackTeamId);

      // Auth gate: admin commands require superadmin, most commands require admin
      if (command.type === "add-admin" || command.type === "remove-admin") {
        if (!isSuperadmin(slackUserId)) {
          return "You are not authorized to use this command.";
        }
      } else if (command.type !== "help") {
        if (!await isAuthorized(slackUserId, team.id)) {
          return "You are not authorized to use this command.";
        }
      }

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
          return `Standup "${command.name}" created for <#${command.channelId}>. Add questions and members, then activate it.`;
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
          return `Schedule set for "${command.name}": ${formatSchedule(result.value)}`;
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
              let member = await ensureMember(team.id, userId);
              if (member.displayName === member.slackUserId) {
                const resolved = await userResolver.lookupByUserId(userId);
                if (resolved) {
                  member = { ...member, displayName: resolved.displayName };
                  await memberRepo.upsert(member);
                }
              }
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
          const removedNames: string[] = [];
          for (const userId of command.userIds) {
            const member = await memberRepo.findBySlackUserId(team.id, userId);
            if (member) {
              await configMemberRepo.removeMember(config.id, member.id);
              removedNames.push(member.displayName);
            }
          }
          if (removedNames.length === 0) return `No members removed from "${command.name}".`;
          return `Removed ${removedNames.length} member(s) from "${command.name}": ${removedNames.join(", ")}`;
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
          let msg = `"${command.name}" activated.`;
          if (!config.schedule) {
            msg += ` Note: no schedule is set — use /tfx-standup schedule to configure when it runs.`;
          }
          return msg;
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
          await subscriptionRepo.deleteByConfigId(config.id);
          await sessionRepo.deleteByConfigId(config.id);
          await questionRepo.deleteByConfigId(config.id);
          await configRepo.delete(config.id);
          return `"${command.name}" deleted.`;
        }

        case "add-admin": {
          const added: string[] = [];
          for (const userId of command.userIds) {
            const admin = {
              id: AdminId(idGen.generate()),
              teamId: team.id,
              slackUserId: userId,
              createdAt: clock.toISOString(),
            };
            await adminRepo.save(admin);
            const resolved = await userResolver.lookupByUserId(userId);
            added.push(resolved?.displayName ?? userId);
          }
          return `Added admin(s): ${added.join(", ")}`;
        }

        case "remove-admin": {
          const removed: string[] = [];
          for (const userId of command.userIds) {
            await adminRepo.delete(team.id, userId);
            const resolved = await userResolver.lookupByUserId(userId);
            removed.push(resolved?.displayName ?? userId);
          }
          return `Removed admin(s): ${removed.join(", ")}`;
        }

        case "list-admins": {
          const adminList = await adminRepo.findByTeam(team.id);
          if (adminList.length === 0) return "No admins configured. The superadmin can add admins with `/tfx-standup add-admin @user`.";
          const names: string[] = [];
          for (const a of adminList) {
            const resolved = await userResolver.lookupByUserId(a.slackUserId);
            names.push(resolved?.displayName ?? `<@${a.slackUserId}>`);
          }
          return `*Admins:*\n${names.map((n) => `• ${n}`).join("\n")}`;
        }

        case "subscribe": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const configMembers = await configMemberRepo.findMembersByConfig(config.id);
          const added: string[] = [];
          const notMembers: string[] = [];
          for (const userId of command.userIds) {
            const member = configMembers.find((m) => m.slackUserId === userId);
            if (!member) {
              const resolved = await userResolver.lookupByUserId(userId);
              notMembers.push(resolved?.displayName ?? userId);
              continue;
            }
            await subscriptionRepo.save({
              configId: config.id,
              subscriberSlackUserId: slackUserId,
              targetMemberId: member.id,
              createdAt: clock.toISOString(),
            });
            added.push(member.displayName);
          }
          const lines: string[] = [];
          if (added.length > 0) lines.push(`Subscribed to updates from: ${added.join(", ")} in "${command.name}".`);
          if (notMembers.length > 0) lines.push(`Not members of "${command.name}": ${notMembers.join(", ")}`);
          return lines.join("\n") || `No subscriptions added for "${command.name}".`;
        }

        case "unsubscribe": {
          const config = await configRepo.findByName(team.id, command.name);
          if (!config) return `Standup "${command.name}" not found.`;
          const removed: string[] = [];
          for (const userId of command.userIds) {
            const member = await memberRepo.findBySlackUserId(team.id, userId);
            if (member) {
              await subscriptionRepo.delete(config.id, slackUserId, member.id);
              removed.push(member.displayName);
            }
          }
          if (removed.length === 0) return `No subscriptions removed for "${command.name}".`;
          return `Unsubscribed from updates from: ${removed.join(", ")} in "${command.name}".`;
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
            const threadTs = await getOrCreateDailyThread(config, session.date);
            await messenger.postToThread(
              config.channelId,
              threadTs,
              formatSkippedSummary(member.displayName, config.name)
            );
          } catch (err) {
            logger.error("Failed to post skip summary to channel", {
              channelId: config.channelId,
              config: config.name,
              error: String(err),
            });
          }
          await messenger.sendDM(slackUserId, `*${config.name}* standup skipped.`);
          await checkAggregatedReports(session.configId, session.date);
        } else {
          await messenger.sendDM(slackUserId, "Standup skipped.");
        }
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
        await messenger.sendDM(slackUserId, `Thanks! Your standup is complete. Your responses have been posted to <#${config.channelId}>.`);
        try {
          const threadTs = await getOrCreateDailyThread(config, activeSession.date);
          await messenger.postToThread(
            config.channelId,
            threadTs,
            formatCompletedSummary(member.displayName, answerResult.session.responses, config.name)
          );
        } catch (err) {
          logger.error("Failed to post completed summary to channel", {
            channelId: config.channelId,
            config: config.name,
            error: String(err),
          });
        }
        await checkAggregatedReports(activeSession.configId, activeSession.date);
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
      logger.info('config', { config });
      if (!config || !config.active) return;

      const questions = sortQuestionsByOrder(
        await questionRepo.findByConfigId(config.id)
      );
      logger.info('questions',  {questions});
      if (questions.length === 0) {
        logger.warn("No questions configured", { configId });
        return;
      }

      const allMembers = await configMemberRepo.findMembersByConfig(config.id);
      const today = clock.todayDateString();
      const existingSessions = await sessionRepo.findByConfigAndDate(config.id, today);
      const existingMemberIds = new Set(existingSessions.map((s) => s.memberId as string));
      const needsStandup = getMembersNeedingStandup(allMembers, existingMemberIds);

      logger.info('preloop', { allMembers, today, existingSessions, existingMemberIds, needsStandup });

      for (let m of needsStandup) {
        logger.info('loop', { m });
        try {
          // Resolve display name if it still equals the raw Slack user ID
          if (m.displayName === m.slackUserId) {
            const resolved = await userResolver.lookupByUserId(m.slackUserId);
            if (resolved) {
              m = { ...m, displayName: resolved.displayName };
              await memberRepo.upsert(m);
            }
          }

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
            formatFirstQuestionDM(config.name, firstQ, questions.length, config.channelId)
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
            const threadTs = await getOrCreateDailyThread(config, session.date);
            await messenger.postToThread(
              config.channelId,
              threadTs,
              formatTimedOutSummary(m.displayName, result.session, questions, config.name)
            );
          } catch (err) {
            logger.error("Failed to post timeout summary to channel", {
              channelId: config.channelId,
              config: config.name,
              error: String(err),
            });
          }
          await messenger.sendDM(m.slackUserId, `Your *${config.name}* standup has timed out.`);
          await checkAggregatedReports(session.configId, session.date);
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
      logger.info("activeConfigs", { activeConfigs });

      for (const config of activeConfigs) {
        try {
          logger.info(`config.schedule`, { config_schedule: config.schedule });
          logger.info(`shouldTrigger(${config.schedule}, ${now})`, { shouldTrigger: shouldTrigger(config.schedule, now)});
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
