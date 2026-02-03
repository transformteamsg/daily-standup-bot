import type { App } from "@slack/bolt";
import type { Messenger } from "@/core/ports";

export function createSlackMessenger(app: App): Messenger {
  return {
    async sendDM(slackUserId: string, text: string): Promise<void> {
      // Open a DM channel, then send the message
      const result = await app.client.conversations.open({
        users: slackUserId,
      });
      const channelId = result.channel?.id;
      if (!channelId) {
        throw new Error(`Failed to open DM channel with user ${slackUserId}`);
      }
      await app.client.chat.postMessage({
        channel: channelId,
        text,
      });
    },

    async postToChannel(channelId: string, text: string): Promise<void> {
      await app.client.chat.postMessage({
        channel: channelId,
        text,
      });
    },

    async validateChannel(channelId: string) {
      try {
        const result = await app.client.conversations.info({ channel: channelId });
        if (!result.ok || !result.channel) {
          return { ok: false as const, error: "Channel not found or bot cannot access it." };
        }
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: `Cannot access channel <#${channelId}>. Make sure the channel exists and is public, or invite the bot first.` };
      }
    },
  };
}
