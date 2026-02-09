import { App, AwsLambdaReceiver } from "@slack/bolt";

export function createLambdaSlackApp(env: { SLACK_BOT_TOKEN: string; SLACK_SIGNING_SECRET: string }) {
  const receiver = new AwsLambdaReceiver({ signingSecret: env.SLACK_SIGNING_SECRET });
  const app = new App({ token: env.SLACK_BOT_TOKEN, receiver });
  return { app, receiver };
}
