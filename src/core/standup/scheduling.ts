import type { Schedule } from "../domain/standup.js";

export function shouldTrigger(
  schedule: Schedule,
  now: Date
): boolean {
  // Convert current time to the schedule's timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: schedule.timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = dayMap[weekday];

  if (dayOfWeek === undefined) return false;

  return (
    hour === schedule.hour &&
    minute === schedule.minute &&
    schedule.days.includes(dayOfWeek)
  );
}

export function toCronExpression(schedule: Schedule): string {
  // node-cron format: minute hour * * dayOfWeek
  return `${schedule.minute} ${schedule.hour} * * ${schedule.days.join(",")}`;
}

export function isSessionExpired(
  deliveredAt: string,
  timeoutMinutes: number,
  now: Date
): boolean {
  const delivered = new Date(deliveredAt);
  const expiresAt = new Date(delivered.getTime() + timeoutMinutes * 60 * 1000);
  return now >= expiresAt;
}

export function parseDaysInput(input: string): number[] | null {
  const lower = input.toLowerCase().trim();

  if (lower === "weekdays") return [1, 2, 3, 4, 5];
  if (lower === "everyday") return [0, 1, 2, 3, 4, 5, 6];

  const dayNameMap: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };

  const parts = lower.split(",").map((s) => s.trim());
  const days: number[] = [];

  for (const part of parts) {
    const day = dayNameMap[part];
    if (day === undefined) return null;
    if (!days.includes(day)) days.push(day);
  }

  return days.length > 0 ? days.sort((a, b) => a - b) : null;
}
