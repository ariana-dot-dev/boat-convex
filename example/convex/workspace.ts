import { v } from "convex/values";
import { Boat } from "@boatdev/convex";
import { components } from "./_generated/api.js";
import { action, query } from "./_generated/server.js";

const boat = new Boat(components.boat);

// Demo only: a real app derives ownerId from ctx.auth, never from the client.
const ref = { ownerId: v.string(), key: v.string() };

/** Reactive: provisioning -> ready shows up here without polling. */
export const status = query({
  args: ref,
  handler: async (ctx, args) => boat.get(ctx, args),
});

export const start = action({
  args: ref,
  handler: async (ctx, args) =>
    boat.create(ctx, { ...args, options: { name: `workspace-${args.key}`, type: "small", ttlSeconds: 1800, noEnv: true } }),
});

export const run = action({
  args: { ...ref, command: v.string() },
  handler: async (ctx, args) => boat.exec(ctx, args),
});

export const save = action({
  args: { ...ref, path: v.string(), content: v.string() },
  handler: async (ctx, args) => boat.writeFile(ctx, args),
});

export const load = action({
  args: { ...ref, path: v.string() },
  handler: async (ctx, args) => boat.readFile(ctx, args),
});

/** Start a web server in the sandbox and return a shareable URL for it. */
export const preview = action({
  args: ref,
  handler: async (ctx, args) => {
    await boat.spawn(ctx, { ...args, command: "python3 -m http.server 8000" });
    return boat.host(ctx, { ...args, port: 8000 });
  },
});

export const pause = action({
  args: ref,
  handler: async (ctx, args) => boat.stop(ctx, args),
});

export const wake = action({
  args: ref,
  handler: async (ctx, args) => boat.resume(ctx, args),
});

export const copy = action({
  args: { ...ref, newKey: v.string() },
  handler: async (ctx, args) => boat.fork(ctx, args),
});

export const destroy = action({
  args: ref,
  handler: async (ctx, args) => boat.destroy(ctx, args),
});
