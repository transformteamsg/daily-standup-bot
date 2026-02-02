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
  };
}
