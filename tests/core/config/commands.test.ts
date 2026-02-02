import { describe, it, expect } from "vitest";
import { parseCommand } from "@/core/config/commands";
import type { StandupCommand } from "@/core/config/commands";

function expectCommand(text: string, expected: StandupCommand) {
  const result = parseCommand(text);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.command).toEqual(expected);
  }
}

function expectError(text: string) {
  const result = parseCommand(text);
  expect(result.ok).toBe(false);
}

describe("parseCommand", () => {
  describe("help", () => {
    it("returns help for empty input", () => {
      expectCommand("", { type: "help" });
    });

    it("returns help for 'help'", () => {
      expectCommand("help", { type: "help" });
    });
  });

  describe("create", () => {
    it("parses create with channel mention", () => {
      expectCommand("create morning <#C123|standup>", {
        type: "create",
        name: "morning",
        channelId: "C123",
      });
    });

    it("parses create with channel mention without name", () => {
      expectCommand("create daily <#C456>", {
        type: "create",
        name: "daily",
        channelId: "C456",
      });
    });

    it("fails without enough args", () => {
      expectError("create");
    });

    it("fails with invalid channel format", () => {
      expectError("create morning #not-a-channel");
    });
  });

  describe("list", () => {
    it("parses list", () => {
      expectCommand("list", { type: "list" });
    });
  });

  describe("show", () => {
    it("parses show with name", () => {
      expectCommand("show morning", { type: "show", name: "morning" });
    });

    it("fails without name", () => {
      expectError("show");
    });
  });

  describe("schedule", () => {
    it("parses schedule with all args", () => {
      expectCommand("schedule morning 09:00 weekdays UTC", {
        type: "schedule",
        name: "morning",
        time: "09:00",
        days: "weekdays",
        timezone: "UTC",
      });
    });

    it("fails without enough args", () => {
      expectError("schedule morning 09:00");
    });
  });

  describe("add-question", () => {
    it("parses question text including spaces", () => {
      expectCommand("add-question morning What did you do yesterday?", {
        type: "add-question",
        name: "morning",
        text: "What did you do yesterday?",
      });
    });

    it("fails without enough args", () => {
      expectError("add-question morning");
    });
  });

  describe("remove-question", () => {
    it("parses question number", () => {
      expectCommand("remove-question morning 2", {
        type: "remove-question",
        name: "morning",
        questionNumber: 2,
      });
    });

    it("fails with non-numeric", () => {
      expectError("remove-question morning abc");
    });

    it("fails with zero", () => {
      expectError("remove-question morning 0");
    });
  });

  describe("add-members", () => {
    it("parses user mentions", () => {
      expectCommand("add-members morning <@U001|alice> <@U002>", {
        type: "add-members",
        name: "morning",
        userIds: ["U001", "U002"],
      });
    });

    it("fails without members", () => {
      expectError("add-members morning");
    });
  });

  describe("remove-members", () => {
    it("parses user mentions", () => {
      expectCommand("remove-members morning <@U001>", {
        type: "remove-members",
        name: "morning",
        userIds: ["U001"],
      });
    });
  });

  describe("timeout", () => {
    it("parses timeout minutes", () => {
      expectCommand("timeout morning 30", {
        type: "timeout",
        name: "morning",
        minutes: 30,
      });
    });

    it("fails with non-numeric", () => {
      expectError("timeout morning abc");
    });
  });

  describe("activate / deactivate / delete", () => {
    it("parses activate", () => {
      expectCommand("activate morning", {
        type: "activate",
        name: "morning",
      });
    });

    it("parses deactivate", () => {
      expectCommand("deactivate morning", {
        type: "deactivate",
        name: "morning",
      });
    });

    it("parses delete", () => {
      expectCommand("delete morning", {
        type: "delete",
        name: "morning",
      });
    });
  });

  describe("unknown subcommand", () => {
    it("returns error for unknown subcommand", () => {
      const result = parseCommand("foobar");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("foobar");
      }
    });
  });
});
