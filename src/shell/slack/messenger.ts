import type { WebClient } from "@slack/web-api";
import type { Logger, Messenger } from "@/core/ports";

export function createSlackMessenger(client: WebClient, logger: Logger): Messenger {
  return {
    async sendDM(slackUserId: string, text: string): Promise<void> {
      // Open a DM channel, then send the message
      const result = await client.conversations.open({
        users: slackUserId,
      });
      const channelId = result.channel?.id;
      if (!channelId) {
        throw new Error(`Failed to open DM channel with user ${slackUserId}`);
      }
      await client.chat.postMessage({
        channel: channelId,
        text,
      });
    },

    async postToChannel(channelId: string, text: string): Promise<void> {
      await client.chat.postMessage({
        channel: channelId,
        text,
      });
    },

    async postToChannelWithTs(channelId: string, text: string): Promise<string> {
      const result = await client.chat.postMessage({
        channel: channelId,
        text,
      });
      return result.ts!;
    },

    async postToThread(channelId: string, threadTs: string, text: string): Promise<void> {
      await client.chat.postMessage({
        channel: channelId,
        text,
        thread_ts: threadTs,
      });
    },

    async validateChannel(channelId: string) {
      try {
        const result = await client.conversations.info({ channel: channelId });
        if (!result.ok || !result.channel) {
          return { ok: false as const, error: "Channel not found or bot cannot access it." };
        }
        if (!result.channel.is_member) {
          return { ok: false as const, error: `Bot is not a member of <#${channelId}>. Please invite the bot to the channel first.` };
        }
        return { ok: true as const };
      } catch (err: unknown) {
        const slackCode = (err as any)?.data?.error ?? "unknown";
        logger.error("validateChannel failed", { channelId, slackCode, error: String(err) });
        return { ok: false as const, error: `Cannot access channel <#${channelId}>: ${slackCode}. Please make sure the channel exists and invite the bot to it.` };
      }
    },
  };
}
