import { App } from "@slack/bolt";
import type { Env } from "@/schemas/env";

export function createSlackApp(env: Env) {
  return new App({
    token: env.SLACK_BOT_TOKEN,
    appToken: env.SLACK_APP_TOKEN,
    signingSecret: env.SLACK_SIGNING_SECRET,
    socketMode: true,
  });
}
