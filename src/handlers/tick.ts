import { createDependencies } from "./shared";

// Module-scope init (reused across warm invocations)
const { orchestrator, migrationPromise } = createDependencies();

export const handler = async () => {
  await migrationPromise;
  await orchestrator.tick();
  return { statusCode: 200 };
};
