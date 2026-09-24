import { v } from "convex/values";
import { action } from "./_generated/server.js";
import { boat, sandboxPath } from "./boat.js";
import { requireLinked } from "./lifecycle.js";

const identity = { ownerId: v.string(), key: v.string() };

// Boat payloads are extensible; these are the fields apps rely on, passed through as-is.
const commandResult = v.object({
  exitCode: v.union(v.number(), v.null()),
  stdout: v.string(),
  stderr: v.string(),
  timedOut: v.boolean(),
  oomKilled: v.optional(v.boolean()),
  stdoutTruncated: v.optional(v.boolean()),
  stderrTruncated: v.optional(v.boolean()),
});

/** Run a shell command and wait for it (up to 600 s, Boat's cap). */
export const exec = action({
  args: {
    ...identity,
    command: v.string(),
    cwd: v.optional(v.string()),
    timeoutSeconds: v.optional(v.number()),
  },
  returns: commandResult,
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const r = await boat<Record<string, unknown>>("POST", sandboxPath(sandboxId, "/commands"), {
      body: { command: args.command, cwd: args.cwd, timeoutSeconds: args.timeoutSeconds },
    });
    return {
      exitCode: (r.exitCode as number | null) ?? null,
      stdout: String(r.stdout ?? ""),
      stderr: String(r.stderr ?? ""),
      timedOut: Boolean(r.timedOut),
      ...(typeof r.oomKilled === "boolean" ? { oomKilled: r.oomKilled } : {}),
      ...(typeof r.stdoutTruncated === "boolean" ? { stdoutTruncated: r.stdoutTruncated } : {}),
      ...(typeof r.stderrTruncated === "boolean" ? { stderrTruncated: r.stderrTruncated } : {}),
    };
  },
});

/** Start a long-running command (dev server, build) in the background; poll it with `commandStatus`. */
export const spawn = action({
  args: { ...identity, command: v.string(), cwd: v.optional(v.string()) },
  returns: v.object({ processId: v.number() }),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const r = await boat<{ processId: number }>("POST", sandboxPath(sandboxId, "/commands"), {
      body: { command: args.command, cwd: args.cwd, detached: true },
    });
    return { processId: r.processId };
  },
});

export const commandStatus = action({
  args: { ...identity, processId: v.number(), tailBytes: v.optional(v.number()) },
  returns: v.object({
    status: v.string(),
    running: v.boolean(),
    exitCode: v.union(v.number(), v.null()),
    stdout: v.string(),
    stderr: v.string(),
  }),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const query = args.tailBytes ? `?tailBytes=${Math.floor(args.tailBytes)}` : "";
    const r = await boat<Record<string, unknown>>(
      "GET",
      sandboxPath(sandboxId, `/commands/${Math.floor(args.processId)}${query}`),
    );
    return {
      status: String(r.status),
      running: Boolean(r.running),
      exitCode: (r.exitCode as number | null) ?? null,
      stdout: String(r.stdout ?? ""),
      stderr: String(r.stderr ?? ""),
    };
  },
});

const encoding = v.optional(v.union(v.literal("utf8"), v.literal("base64")));

/** Paths resolve under /home/user (relative) or /tmp. */
export const readFile = action({
  args: { ...identity, path: v.string(), encoding },
  returns: v.string(),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const params = new URLSearchParams({ path: args.path, encoding: args.encoding ?? "utf8" });
    const r = await boat<{ content: string }>("GET", sandboxPath(sandboxId, `/files?${params}`));
    return r.content;
  },
});

export const writeFile = action({
  args: { ...identity, path: v.string(), content: v.string(), encoding },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    await boat("PUT", sandboxPath(sandboxId, "/files"), {
      body: { path: args.path, content: args.content, encoding: args.encoding ?? "utf8" },
    });
    return null;
  },
});

/** Public HTTPS URL for a port inside the sandbox. Token-gated unless `public: true`. */
export const host = action({
  args: { ...identity, port: v.number(), public: v.optional(v.boolean()) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const r = await boat<{ url: string }>("POST", sandboxPath(sandboxId, "/host"), {
      body: { port: args.port, public: args.public ?? false },
    });
    return { url: r.url };
  },
});

/** Queue a task for a coding agent (Claude Code, Codex, pi, OpenCode, ...) running inside the sandbox. */
export const prompt = action({
  args: {
    ...identity,
    prompt: v.string(),
    provider: v.string(),
    model: v.optional(v.string()),
    reasoningEffort: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    newConversation: v.optional(v.boolean()),
  },
  returns: v.object({ promptId: v.string(), conversationId: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const r = await boat<{ promptId: string; conversationId?: string | null }>(
      "POST",
      sandboxPath(sandboxId, "/prompt"),
      {
        body: {
          prompt: args.prompt,
          provider: args.provider,
          model: args.model,
          reasoningEffort: args.reasoningEffort,
          conversationId: args.conversationId,
          ...(args.newConversation ? { new: true } : {}),
        },
      },
    );
    return { promptId: r.promptId, conversationId: r.conversationId ?? null };
  },
});

export const promptStatus = action({
  args: { ...identity, promptId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const r = await boat<{ promptRun: unknown }>(
      "GET",
      sandboxPath(sandboxId, `/prompts/${encodeURIComponent(args.promptId)}`),
    );
    return r.promptRun;
  },
});

/** The agent's work (prompts, responses, tool calls), oldest first from `cursor`. */
export const events = action({
  args: {
    ...identity,
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
    conversation: v.optional(v.string()),
  },
  returns: v.object({ events: v.array(v.any()), nextCursor: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const { sandboxId } = await requireLinked(ctx, args.ownerId, args.key);
    const params = new URLSearchParams({ sort: "asc", limit: String(Math.floor(args.limit ?? 100)) });
    if (args.cursor) params.set("cursor", args.cursor);
    if (args.conversation) params.set("conversation", args.conversation);
    const r = await boat<{ events: unknown[]; pageInfo?: { nextCursor?: string | null } }>(
      "GET",
      sandboxPath(sandboxId, `/events?${params}`),
    );
    return { events: r.events ?? [], nextCursor: r.pageInfo?.nextCursor ?? null };
  },
});
