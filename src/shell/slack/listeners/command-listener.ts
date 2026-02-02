import type { App } from "@slack/bolt";
import type { Orchestrator } from "@/shell/orchestrator";
import { parseCommand } from "@/core/config/commands";
import { formatHelpMessage } from "@/core/standup/formatting";

export function registerCommandListener(app: App, orchestrator: Orchestrator) {
  app.command("/standup", async ({ command, ack, respond }) => {
    await ack();

    const parsed = parseCommand(command.text);
    if (!parsed.ok) {
      await respond(parsed.error);
      return;
    }

    if (parsed.command.type === "help") {
      await respond(formatHelpMessage());
      return;
    }

    const result = await orchestrator.handleCommand(
      parsed.command,
      command.team_id,
      command.user_id
    );
    await respond(result);
  });
}
