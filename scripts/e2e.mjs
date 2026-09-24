// End-to-end: the example app, on a real Convex deployment, driving real Boat sandboxes.
//   npx convex env set BOAT_API_KEY boat_...   (once)
//   npx convex dev --once && npm run e2e
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const url =
  process.env.CONVEX_URL ?? readFileSync(".env.local", "utf8").match(/^CONVEX_URL=(.*)$/m)?.[1];
if (!url) throw new Error("CONVEX_URL is not set (run `npx convex dev --once` first)");

const client = new ConvexHttpClient(url);
const w = anyApi.workspace;
const ownerId = `e2e-${Date.now()}`;
const a = { ownerId, key: "a" };
const b = { ownerId, key: "b" };
const t0 = Date.now();
const log = (step, extra = "") => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s  ${step} ${extra}`);

/** Wait on the reactive query alone: the component's scheduler must move the state, not us. */
async function waitFor(ref, states, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const record = await client.query(w.status, ref);
    if (record && states.includes(record.state)) return record;
    if (record?.state === "error") throw new Error(`sandbox errored: ${record.lastError}`);
    if (Date.now() > deadline) throw new Error(`timed out in ${record?.state}: ${record?.lastError ?? ""}`);
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

const READY = ["ready", "idle", "running"];
try {
  const created = await client.action(w.start, a);
  log("create", `${created.sandboxId} ${created.state}`);
  const again = await client.action(w.start, a);
  assert.equal(again.sandboxId, created.sandboxId, "create is idempotent per key");
  log("create again: same sandbox");

  await waitFor(a, READY);
  log("ready (seen through the reactive query)");

  const run = await client.action(w.run, { ...a, command: "echo hello from $(uname -s)" });
  assert.equal(run.exitCode, 0, run.stderr);
  assert.equal(run.stdout.trim(), "hello from Linux");
  log("exec", JSON.stringify(run.stdout.trim()));

  await client.action(w.save, { ...a, path: "notes/todo.txt", content: "ship it\n" });
  assert.equal(await client.action(w.load, { ...a, path: "notes/todo.txt" }), "ship it\n");
  log("write + read file");

  const { url: preview } = await client.action(w.preview, a);
  // The token link sets an access cookie and redirects, as a browser would follow it.
  const visit = async () => {
    const first = await fetch(preview, { redirect: "manual" });
    if (first.status !== 302) return first.status;
    const cookie = first.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    return (await fetch(new URL(first.headers.get("location"), preview), { headers: { cookie } })).status;
  };
  let status = 0;
  for (let i = 0; i < 20 && status !== 200; i++) {
    status = await visit().catch(() => 0);
    if (status !== 200) await new Promise((r) => setTimeout(r, 1_500));
  }
  assert.equal(status, 200, `preview ${preview.replace(/_token=[^&]+/, "_token=…")}`);
  log("preview URL serves 200");

  await client.action(w.pause, a);
  await waitFor(a, ["archived"]);
  log("stopped (archived)");

  // A fork copies the latest snapshot, which a stop always takes.
  const fork = await client.action(w.copy, { ...a, newKey: "b" });
  assert.notEqual(fork.sandboxId, created.sandboxId);
  await waitFor(b, READY);
  assert.equal(await client.action(w.load, { ...b, path: "notes/todo.txt" }), "ship it\n");
  log("fork has the file", fork.sandboxId);

  await client.action(w.wake, a);
  await waitFor(a, READY);
  assert.equal(await client.action(w.load, { ...a, path: "notes/todo.txt" }), "ship it\n");
  log("resumed, file survived");
} finally {
  for (const ref of [a, b]) {
    await client.action(w.destroy, ref).catch((e) => console.error(`destroy ${ref.key}:`, e.message));
  }
  assert.equal(await client.query(w.status, a), null);
  log("destroyed both");
}
console.log("E2E PASSED");
