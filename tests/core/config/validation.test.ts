import { describe, it, expect } from "vitest";
import {
  validateScheduleInput,
  validateTimeout,
  validateStandupName,
} from "@/core/config/validation";

describe("validateScheduleInput", () => {
  it("validates a correct schedule", () => {
    const result = validateScheduleInput("09:00", "weekdays", "UTC");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.hour).toBe(9);
      expect(result.value.minute).toBe(0);
      expect(result.value.days).toEqual([1, 2, 3, 4, 5]);
      expect(result.value.timezone).toBe("UTC");
    }
  });

  it("rejects invalid time format", () => {
    const result = validateScheduleInput("9am", "weekdays", "UTC");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid days", () => {
    const result = validateScheduleInput("09:00", "invalid", "UTC");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid timezone", () => {
    const result = validateScheduleInput("09:00", "weekdays", "Fake/Zone");
    expect(result.ok).toBe(false);
  });

  it("accepts named timezone", () => {
    const result = validateScheduleInput("09:00", "mon,wed,fri", "America/New_York");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.days).toEqual([1, 3, 5]);
    }
  });
});

describe("validateTimeout", () => {
  it("accepts valid timeout", () => {
    const result = validateTimeout(60);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(60);
  });

  it("rejects too small timeout", () => {
    const result = validateTimeout(2);
    expect(result.ok).toBe(false);
  });

  it("rejects too large timeout", () => {
    const result = validateTimeout(500);
    expect(result.ok).toBe(false);
  });

  it("accepts boundary values", () => {
    expect(validateTimeout(5).ok).toBe(true);
    expect(validateTimeout(480).ok).toBe(true);
  });
});

describe("validateStandupName", () => {
  it("accepts valid names", () => {
    expect(validateStandupName("morning").ok).toBe(true);
    expect(validateStandupName("daily-standup").ok).toBe(true);
    expect(validateStandupName("team_1").ok).toBe(true);
  });

  it("rejects empty name", () => {
    expect(validateStandupName("").ok).toBe(false);
  });

  it("rejects names with spaces", () => {
    expect(validateStandupName("morning standup").ok).toBe(false);
  });

  it("rejects names with special characters", () => {
    expect(validateStandupName("morning!").ok).toBe(false);
  });

  it("rejects names over 80 characters", () => {
    expect(validateStandupName("a".repeat(81)).ok).toBe(false);
  });
});
