import { z } from "zod";

export const envSchema = z.object({
  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  DATABASE_URL: z.string().default("postgresql://standup:standup@localhost:5432/standup"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SUPERADMIN_USER_ID: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
