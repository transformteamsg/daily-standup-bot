import type { App } from "@slack/bolt";
import type { Orchestrator } from "@/shell/orchestrator";
import { slackDMEventSchema } from "@/schemas/slack";

export function registerMessageListener(
  app: App,
  orchestrator: Orchestrator
) {
  app.message(async ({ message }) => {
    // Only handle DMs from users (not bot messages)
    if (!("channel_type" in message) || message.channel_type !== "im") return;
    if ("bot_id" in message) return;
    if (message.subtype) return;

    const parsed = slackDMEventSchema.safeParse(message);
    if (!parsed.success) return;

    const event = parsed.data;
    await orchestrator.handleAnswer(event.user, event.text);
  });
}
