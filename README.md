# Boat Convex Component

Give every user, job or agent in your Convex app its own [Boat](https://boat.dev) sandbox: a full root Ubuntu VM
(Docker, every toolchain, public IPv4) that stops to a snapshot when idle and resumes exactly where it left off.

- **Reactive.** Sandbox state lives in a Convex table. `useQuery` shows `provisioning` → `ready` → `archived` live; the
  component follows every transition itself.
- **Retry-safe.** One sandbox per `(ownerId, key)`. A retried `create` or `fork` returns the same sandbox and never bills
  a second one (Boat idempotency keys).
- **Your key stays server-side.** `BOAT_API_KEY` is a component env var; it never reaches your app code or the browser.
- **Everything a coding product needs:** exec, background processes, files, public preview URLs, stop/resume, disk-level
  fork, and coding agents (Claude Code, Codex, pi, OpenCode) running inside the sandbox.

## Install

```sh
npm install @boatdev/convex
```

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import { v } from "convex/values";
import boat from "@boatdev/convex/convex.config.js";

const app = defineApp({ env: { BOAT_API_KEY: v.string() } });
app.use(boat, { env: { BOAT_API_KEY: app.env.BOAT_API_KEY } });
export default app;
```

```sh
npx convex env set BOAT_API_KEY boat_...   # from the Boat dashboard, API keys tab
```

## Use

```ts
// convex/workspace.ts
import { Boat } from "@boatdev/convex";
import { components } from "./_generated/api";
import { action, query } from "./_generated/server";
import { v } from "convex/values";

const boat = new Boat(components.boat);

async function owner(ctx: { auth: { getUserIdentity(): Promise<{ subject: string } | null> } }) {
  const user = await ctx.auth.getUserIdentity();
  if (!user) throw new Error("Not signed in");
  return user.subject;
}

export const status = query({
  args: {},
  handler: async (ctx) => boat.get(ctx, { ownerId: await owner(ctx), key: "workspace" }),
});

export const start = action({
  args: {},
  handler: async (ctx) =>
    boat.create(ctx, {
      ownerId: await owner(ctx),
      key: "workspace",
      options: { type: "small", ttlSeconds: 1800, noEnv: true },
    }),
});

export const run = action({
  args: { command: v.string() },
  handler: async (ctx, { command }) =>
    boat.exec(ctx, { ownerId: await owner(ctx), key: "workspace", command }),
});
```

```tsx
const sandbox = useQuery(api.workspace.status); // live: provisioning -> ready
```

Always derive `ownerId` from `ctx.auth`, never from client arguments. The component has no auth of its own.

## API

Every call names a sandbox by `{ ownerId, key }`.

| Method | What it does |
|---|---|
| `get`, `list` | Reactive reads of the cached state (queries). |
| `create({ options })` | Create, or return the existing sandbox for this key. Options: `name`, `type` (`small`/`default`/`large`), `ttlSeconds` (auto-stop, `null` = never), `env`, `noEnv`, `environment`, `setupScript`, `from` (named snapshot). |
| `refresh` | Pull the live state from Boat, e.g. after an auto-stop. |
| `stop({ force? })` | Snapshot the disk and stop billing. |
| `resume({ options? })` | Bring it back exactly as it was, optionally on another size. |
| `fork({ newKey })` | Copy the sandbox, disk and all, into a new one. Copies the latest snapshot, which every stop takes. |
| `destroy` | Permanently delete the sandbox and its snapshots. |
| `exec({ command, cwd?, timeoutSeconds? })` | Run and wait (up to 600 s). |
| `spawn({ command })` → `commandStatus({ processId })` | Background process (dev server, long build) and its logs. |
| `readFile`, `writeFile` | `utf8` or `base64`; paths under `/home/user` or `/tmp`. |
| `host({ port, public? })` | Public HTTPS URL for a port. Token-gated unless `public: true`. |
| `prompt({ prompt, provider })` → `events`, `promptStatus` | Hand a task to a coding agent inside the sandbox and follow its work. |

## Multi-tenant safety

By default a sandbox inherits your Boat account's secrets and repos. For sandboxes your users drive, pass
`noEnv: true` and give each sandbox only what it needs through `env`.

## Develop

```sh
npm install
npm test                                # offline, Boat API mocked
CONVEX_AGENT_MODE=anonymous npx convex init
npx convex env set BOAT_API_KEY boat_...
npx convex dev                          # local backend + the example app
npm run e2e                             # real sandboxes: create, exec, files, preview, stop, fork, resume, destroy
```

## License

MIT
