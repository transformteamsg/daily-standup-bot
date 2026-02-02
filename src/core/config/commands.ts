// Slash command parsing — pure functions

export type StandupCommand =
  | { readonly type: "create"; readonly name: string; readonly channelId: string }
  | { readonly type: "list" }
  | { readonly type: "show"; readonly name: string }
  | {
      readonly type: "schedule";
      readonly name: string;
      readonly time: string;
      readonly days: string;
      readonly timezone: string;
    }
  | { readonly type: "add-question"; readonly name: string; readonly text: string }
  | { readonly type: "remove-question"; readonly name: string; readonly questionNumber: number }
  | { readonly type: "add-members"; readonly name: string; readonly userIds: readonly string[] }
  | { readonly type: "remove-members"; readonly name: string; readonly userIds: readonly string[] }
  | { readonly type: "timeout"; readonly name: string; readonly minutes: number }
  | { readonly type: "activate"; readonly name: string }
  | { readonly type: "deactivate"; readonly name: string }
  | { readonly type: "delete"; readonly name: string }
  | { readonly type: "help" };

export type ParseResult =
  | { readonly ok: true; readonly command: StandupCommand }
  | { readonly ok: false; readonly error: string };

export function parseCommand(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "help") {
    return { ok: true, command: { type: "help" } };
  }

  const parts = trimmed.split(/\s+/);
  const subcommand = parts[0]!;

  switch (subcommand) {
    case "create":
      return parseCreate(parts.slice(1));
    case "list":
      return { ok: true, command: { type: "list" } };
    case "show":
      return parseSingleName(parts.slice(1), "show");
    case "schedule":
      return parseSchedule(parts.slice(1));
    case "add-question":
      return parseAddQuestion(parts.slice(1), trimmed);
    case "remove-question":
      return parseRemoveQuestion(parts.slice(1));
    case "add-members":
      return parseMembers(parts.slice(1), "add-members");
    case "remove-members":
      return parseMembers(parts.slice(1), "remove-members");
    case "timeout":
      return parseTimeout(parts.slice(1));
    case "activate":
      return parseSingleName(parts.slice(1), "activate");
    case "deactivate":
      return parseSingleName(parts.slice(1), "deactivate");
    case "delete":
      return parseSingleName(parts.slice(1), "delete");
    case "help":
      return { ok: true, command: { type: "help" } };
    default:
      return { ok: false, error: `Unknown subcommand: ${subcommand}` };
  }
}

function parseCreate(args: string[]): ParseResult {
  if (args.length < 2) {
    return { ok: false, error: "Usage: /standup create <name> <#channel>" };
  }
  const name = args[0]!;
  const channelRaw = args[1]!;
  // Slack formats channel mentions as <#C123|channel-name> or <#C123>
  const channelMatch = channelRaw.match(/^<#([A-Z0-9]+)(?:\|[^>]*)?>$/);
  if (!channelMatch) {
    return { ok: false, error: "Please mention a channel (e.g., #standup)" };
  }
  return {
    ok: true,
    command: { type: "create", name, channelId: channelMatch[1]! },
  };
}

function parseSingleName(
  args: string[],
  type: "show" | "activate" | "deactivate" | "delete"
): ParseResult {
  if (args.length < 1) {
    return { ok: false, error: `Usage: /standup ${type} <name>` };
  }
  return { ok: true, command: { type, name: args[0]! } };
}

function parseSchedule(args: string[]): ParseResult {
  if (args.length < 4) {
    return {
      ok: false,
      error:
        "Usage: /standup schedule <name> <HH:MM> <days> <timezone>\ndays: mon,tue,wed,thu,fri or weekdays or everyday",
    };
  }
  return {
    ok: true,
    command: {
      type: "schedule",
      name: args[0]!,
      time: args[1]!,
      days: args[2]!,
      timezone: args[3]!,
    },
  };
}

function parseAddQuestion(args: string[], fullText: string): ParseResult {
  if (args.length < 2) {
    return {
      ok: false,
      error: "Usage: /standup add-question <name> <question text>",
    };
  }
  const name = args[0]!;
  // Extract question text: everything after "add-question <name> "
  const prefix = `add-question ${name} `;
  const idx = fullText.indexOf(prefix);
  const text = idx >= 0 ? fullText.slice(idx + prefix.length).trim() : args.slice(1).join(" ");
  return { ok: true, command: { type: "add-question", name, text } };
}

function parseRemoveQuestion(args: string[]): ParseResult {
  if (args.length < 2) {
    return {
      ok: false,
      error: "Usage: /standup remove-question <name> <question-number>",
    };
  }
  const num = parseInt(args[1]!, 10);
  if (isNaN(num) || num < 1) {
    return { ok: false, error: "Question number must be a positive integer" };
  }
  return {
    ok: true,
    command: { type: "remove-question", name: args[0]!, questionNumber: num },
  };
}

function parseMembers(
  args: string[],
  type: "add-members" | "remove-members"
): ParseResult {
  if (args.length < 2) {
    return {
      ok: false,
      error: `Usage: /standup ${type} <name> @user1 @user2 ...`,
    };
  }
  const name = args[0]!;
  // Slack formats user mentions as <@U12345> or <@U12345|name>
  const userIds = args.slice(1).map((arg) => {
    const match = arg.match(/^<@([A-Z0-9]+)(?:\|[^>]*)?>$/);
    return match ? match[1]! : arg;
  });
  return { ok: true, command: { type, name, userIds } };
}

function parseTimeout(args: string[]): ParseResult {
  if (args.length < 2) {
    return { ok: false, error: "Usage: /standup timeout <name> <minutes>" };
  }
  const minutes = parseInt(args[1]!, 10);
  if (isNaN(minutes)) {
    return { ok: false, error: "Timeout must be a number" };
  }
  return {
    ok: true,
    command: { type: "timeout", name: args[0]!, minutes },
  };
}
