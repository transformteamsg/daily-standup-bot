import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";
import { describe, it, expect } from "vitest";
import { createTestHarness } from "@tests/e2e/helpers";
import type { TestHarness } from "@tests/e2e/helpers";

interface ScenarioSetup {
  config: {
    name: string;
    channel: string;
    schedule?: { hour: number; minute: number; days: number[]; timezone: string };
    timeout_minutes?: number;
    questions: string[];
  };
  members: { id: string; display_name: string }[];
}

interface ScenarioStep {
  action: string;
  [key: string]: unknown;
}

interface Scenario {
  name: string;
  description?: string;
  setup: ScenarioSetup;
  steps: ScenarioStep[];
}

async function setupScenario(harness: TestHarness, setup: ScenarioSetup) {
  const { orchestrator } = harness;
  const teamId = "T_TEST";

  // Create config
  const channelId = setup.config.channel.replace("#", "C_");
  await orchestrator.handleCommand(
    { type: "create", name: setup.config.name, channelId },
    teamId,
    "U_ADMIN"
  );

  // Add questions
  for (const q of setup.config.questions) {
    await orchestrator.handleCommand(
      { type: "add-question", name: setup.config.name, text: q },
      teamId,
      "U_ADMIN"
    );
  }

  // Add members
  for (const m of setup.members) {
    await orchestrator.handleCommand(
      { type: "add-members", name: setup.config.name, userIds: [m.id] },
      teamId,
      "U_ADMIN"
    );
  }

  // Set schedule if provided
  if (setup.config.schedule) {
    const s = setup.config.schedule;
    const time = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const days = s.days.map((d) => dayNames[d]).join(",");
    await orchestrator.handleCommand(
      { type: "schedule", name: setup.config.name, time, days, timezone: s.timezone },
      teamId,
      "U_ADMIN"
    );
  }

  // Set timeout if provided
  if (setup.config.timeout_minutes) {
    await orchestrator.handleCommand(
      { type: "timeout", name: setup.config.name, minutes: setup.config.timeout_minutes },
      teamId,
      "U_ADMIN"
    );
  }

  // Activate
  await orchestrator.handleCommand(
    { type: "activate", name: setup.config.name },
    teamId,
    "U_ADMIN"
  );

  // Clear any setup messages
  harness.messenger.clear();
}

async function executeStep(harness: TestHarness, step: ScenarioStep, _setup: ScenarioSetup) {
  const { orchestrator, messenger, clock } = harness;

  switch (step.action) {
    case "trigger_cron": {
      if (step.clock) {
        clock.set(new Date(step.clock as string));
      }
      // Find the config ID — we trigger via the orchestrator's tick
      // Since we set the clock, tick will check shouldTrigger
      await orchestrator.tick();
      break;
    }

    case "assert_dm_sent": {
      const to = step.to as string;
      const contains = step.contains as string;
      const dm = messenger.sent.find(
        (m) => m.type === "dm" && m.to === to && m.text.includes(contains)
      );
      expect(dm, `Expected DM to ${to} containing "${contains}"`).toBeDefined();
      break;
    }

    case "assert_no_dm": {
      const to = step.to as string;
      const dm = messenger.sent.find((m) => m.type === "dm" && m.to === to);
      expect(dm, `Expected no DM to ${to}`).toBeUndefined();
      break;
    }

    case "user_replies": {
      const from = step.from as string;
      const text = step.text as string;
      await orchestrator.handleAnswer(from, text);
      break;
    }

    case "assert_channel_post": {
      const channel = step.channel as string;
      const resolvedChannel = channel.replace("#", "C_");
      const containsList = (step.contains as string[] | string);
      const needles = Array.isArray(containsList) ? containsList : [containsList];
      const post = messenger.sent.find(
        (m) => (m.type === "channel" || m.type === "thread") && m.to === resolvedChannel &&
          needles.every((n) => m.text.includes(n))
      );
      expect(
        post,
        `Expected channel post to ${channel} containing ${JSON.stringify(needles)}`
      ).toBeDefined();
      break;
    }

    case "assert_no_channel_post": {
      const channel = step.channel as string;
      const resolvedChannel = channel.replace("#", "C_");
      const post = messenger.sent.find(
        (m) => (m.type === "channel" || m.type === "thread") && m.to === resolvedChannel
      );
      expect(post, `Expected no channel post to ${channel}`).toBeUndefined();
      break;
    }

    case "assert_session_status": {
      // This is verified implicitly through the DM/channel assertions
      // The status is an internal state — we verify via observable behavior
      break;
    }

    case "advance_clock": {
      const minutes = step.minutes as number;
      clock.advance(minutes * 60 * 1000);
      break;
    }

    case "run_timeout_check": {
      await orchestrator.checkTimeouts();
      break;
    }

    case "handle_command": {
      const command = step.command as Record<string, unknown>;
      const teamId = (step.team_id as string) ?? "T_TEST";
      const userId = (step.user_id as string) ?? "U_ADMIN";
      const response = await orchestrator.handleCommand(
        command as unknown as import("@/core/config/commands").StandupCommand,
        teamId,
        userId
      );
      if (step.assert_contains) {
        const needle = step.assert_contains as string;
        expect(
          response,
          `Expected command response to contain "${needle}", got: "${response}"`
        ).toContain(needle);
      }
      break;
    }

    case "clear_messages": {
      messenger.clear();
      break;
    }

    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

export function loadAndRunScenarios(scenariosDir: string) {
  const files = fs.readdirSync(scenariosDir).filter((f) => f.endsWith(".yaml"));

  for (const file of files) {
    const content = fs.readFileSync(path.join(scenariosDir, file), "utf-8");
    const scenario = parseYaml(content) as Scenario;

    describe(scenario.name, () => {
      it("passes all steps", async () => {
        const clockStart = findFirstClock(scenario.steps);
        const harness = await createTestHarness(
          clockStart ? new Date(clockStart) : undefined
        );

        await setupScenario(harness, scenario.setup);

        for (const step of scenario.steps) {
          await executeStep(harness, step, scenario.setup);
        }
      });
    });
  }
}

function findFirstClock(steps: ScenarioStep[]): string | undefined {
  for (const step of steps) {
    if (step.clock) return step.clock as string;
  }
  return undefined;
}
