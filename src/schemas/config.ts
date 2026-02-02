import { z } from "zod";

export const scheduleSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  days: z.array(z.number().int().min(0).max(6)).min(1),
  timezone: z.string().min(1),
});

export const standupConfigInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[\w-]+$/, "Name must be alphanumeric with dashes/underscores"),
  channelId: z.string().min(1),
});

export const timeoutSchema = z
  .number()
  .int()
  .min(5)
  .max(480);

export type ScheduleInput = z.infer<typeof scheduleSchema>;
