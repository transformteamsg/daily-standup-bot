import { z } from "zod";

export const slackDMEventSchema = z.object({
  type: z.literal("message"),
  channel_type: z.literal("im"),
  user: z.string().min(1),
  text: z.string(),
  channel: z.string().min(1),
  ts: z.string(),
});

export type SlackDMEvent = z.infer<typeof slackDMEventSchema>;

export const slackCommandPayloadSchema = z.object({
  command: z.literal("/tfx-standup"),
  text: z.string(),
  user_id: z.string().min(1),
  team_id: z.string().min(1),
  channel_id: z.string().min(1),
});

export type SlackCommandPayload = z.infer<typeof slackCommandPayloadSchema>;
