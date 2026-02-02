import { scheduleSchema, timeoutSchema } from "@/schemas/config";
import type { Schedule } from "@/core/domain/standup";
import { parseDaysInput } from "@/core/standup/scheduling";

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export function validateScheduleInput(
  time: string,
  days: string,
  timezone: string
): ValidationResult<Schedule> {
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!timeMatch) {
    return { ok: false, error: "Time must be in HH:MM format" };
  }

  const hour = parseInt(timeMatch[1]!, 10);
  const minute = parseInt(timeMatch[2]!, 10);

  const parsedDays = parseDaysInput(days);
  if (!parsedDays) {
    return {
      ok: false,
      error:
        "Invalid days. Use: mon,tue,wed,thu,fri or weekdays or everyday",
    };
  }

  // Validate timezone
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    return { ok: false, error: `Invalid timezone: ${timezone}` };
  }

  const result = scheduleSchema.safeParse({
    hour,
    minute,
    days: parsedDays,
    timezone,
  });

  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Invalid schedule" };
  }

  return { ok: true, value: result.data };
}

export function validateTimeout(minutes: number): ValidationResult<number> {
  const result = timeoutSchema.safeParse(minutes);
  if (!result.success) {
    return {
      ok: false,
      error: "Timeout must be between 5 and 480 minutes",
    };
  }
  return { ok: true, value: result.data };
}

export function validateStandupName(name: string): ValidationResult<string> {
  if (!name || name.length === 0) {
    return { ok: false, error: "Name is required" };
  }
  if (name.length > 80) {
    return { ok: false, error: "Name must be 80 characters or less" };
  }
  if (!/^[\w-]+$/.test(name)) {
    return {
      ok: false,
      error: "Name must be alphanumeric with dashes/underscores only",
    };
  }
  return { ok: true, value: name };
}
