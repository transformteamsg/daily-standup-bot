import { createLambdaSlackApp } from "@/shell/slack/app-lambda";
import { createDependencies } from "./shared";
import { registerCommandListener } from "@/shell/slack/listeners/command-listener";
import { registerMessageListener } from "@/shell/slack/listeners/message-listener";

// Module-scope init (reused across warm invocations)
const { env, orchestrator, migrationPromise } = createDependencies();
const { app, receiver } = createLambdaSlackApp(env);

registerCommandListener(app, orchestrator);
registerMessageListener(app, orchestrator);

export const handler = async (event: any, context: any, callback: any) => {
  await migrationPromise;
  const lambdaHandler = await receiver.start();
  return lambdaHandler(event, context, callback);
};
