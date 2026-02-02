import cron from "node-cron";
import type { Logger } from "@/core/ports";

export interface ScheduledJob {
  stop(): void;
}

export function scheduleJob(
  expression: string,
  callback: () => void | Promise<void>,
  logger: Logger
): ScheduledJob {
  const task = cron.schedule(expression, async () => {
    try {
      await callback();
    } catch (err) {
      logger.error("Cron job failed", {
        expression,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return {
    stop() {
      task.stop();
    },
  };
}

export function scheduleEveryMinute(
  callback: () => void | Promise<void>,
  logger: Logger
): ScheduledJob {
  return scheduleJob("* * * * *", callback, logger);
}
