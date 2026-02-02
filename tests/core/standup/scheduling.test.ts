import { describe, it, expect } from "vitest";
import {
  shouldTrigger,
  toCronExpression,
  isSessionExpired,
  parseDaysInput,
} from "@/core/standup/scheduling";
import type { Schedule } from "@/core/domain/standup";

const weekdaySchedule: Schedule = {
  hour: 9,
  minute: 0,
  days: [1, 2, 3, 4, 5],
  timezone: "UTC",
};

describe("shouldTrigger", () => {
  it("returns true when time and day match", () => {
    // Monday 09:00 UTC
    const now = new Date("2025-01-06T09:00:00Z");
    expect(shouldTrigger(weekdaySchedule, now)).toBe(true);
  });

  it("returns false when time does not match", () => {
    // Monday 10:00 UTC
    const now = new Date("2025-01-06T10:00:00Z");
    expect(shouldTrigger(weekdaySchedule, now)).toBe(false);
  });

  it("returns false on weekend for weekday schedule", () => {
    // Saturday 09:00 UTC
    const now = new Date("2025-01-04T09:00:00Z");
    expect(shouldTrigger(weekdaySchedule, now)).toBe(false);
  });

  it("handles timezone conversion", () => {
    const nycSchedule: Schedule = {
      hour: 9,
      minute: 0,
      days: [1, 2, 3, 4, 5],
      timezone: "America/New_York",
    };
    // 14:00 UTC = 09:00 EST on a Monday
    const now = new Date("2025-01-06T14:00:00Z");
    expect(shouldTrigger(nycSchedule, now)).toBe(true);
  });
});

describe("toCronExpression", () => {
  it("converts schedule to cron expression", () => {
    const result = toCronExpression(weekdaySchedule);
    expect(result).toBe("0 9 * * 1,2,3,4,5");
  });

  it("handles single day", () => {
    const schedule: Schedule = {
      hour: 15,
      minute: 30,
      days: [1],
      timezone: "UTC",
    };
    expect(toCronExpression(schedule)).toBe("30 15 * * 1");
  });
});

describe("isSessionExpired", () => {
  it("returns true when past timeout", () => {
    const deliveredAt = "2025-01-06T09:00:00Z";
    const now = new Date("2025-01-06T10:01:00Z"); // 61 min later
    expect(isSessionExpired(deliveredAt, 60, now)).toBe(true);
  });

  it("returns false when within timeout", () => {
    const deliveredAt = "2025-01-06T09:00:00Z";
    const now = new Date("2025-01-06T09:30:00Z"); // 30 min later
    expect(isSessionExpired(deliveredAt, 60, now)).toBe(false);
  });

  it("returns true at exact timeout boundary", () => {
    const deliveredAt = "2025-01-06T09:00:00Z";
    const now = new Date("2025-01-06T10:00:00Z"); // exactly 60 min
    expect(isSessionExpired(deliveredAt, 60, now)).toBe(true);
  });
});

describe("parseDaysInput", () => {
  it("parses weekdays shortcut", () => {
    expect(parseDaysInput("weekdays")).toEqual([1, 2, 3, 4, 5]);
  });

  it("parses everyday shortcut", () => {
    expect(parseDaysInput("everyday")).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("parses comma-separated day names", () => {
    expect(parseDaysInput("mon,wed,fri")).toEqual([1, 3, 5]);
  });

  it("handles case insensitivity", () => {
    expect(parseDaysInput("Mon,WED,Fri")).toEqual([1, 3, 5]);
  });

  it("removes duplicates and sorts", () => {
    expect(parseDaysInput("fri,mon,fri")).toEqual([1, 5]);
  });

  it("returns null for invalid input", () => {
    expect(parseDaysInput("invalid")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDaysInput("")).toBeNull();
  });
});
