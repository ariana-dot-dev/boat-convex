/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";

const modules = import.meta.glob("./**/*.ts");
const owner = { ownerId: "user-1", key: "main" };

type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };

/** A fake Boat: one sandbox that goes provisioning -> idle on its second GET. */
function fakeBoat() {
  const calls: Call[] = [];
  let gets = 0;
  const sandbox = (state: string) => ({ id: "bx_23456789", name: "main", state, url: null, desktopAvailable: false, snapshotAvailable: false });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname.replace("/api/v1", "");
    calls.push({
      method: init.method ?? "GET",
      path,
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (init.method === "POST" && path === "/sandboxes") return json({ ok: true, sandbox: sandbox("provisioning") }, 202);
    if (init.method === "GET" && path === "/sandboxes/bx_23456789") return json({ ok: true, sandbox: sandbox(++gets > 1 ? "idle" : "provisioning") });
    if (init.method === "DELETE") return json({ ok: true, operation: {} }, 202);
    if (path.endsWith("/commands")) return json({ ok: true, exitCode: 0, stdout: "hi\n", stderr: "", timedOut: false });
    return json({ ok: false, code: "sandbox_not_found", message: "nope" }, 404);
  });
  return calls;
}

describe("boat component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("BOAT_API_KEY", "boat_test");
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("create is idempotent per key and settles to ready on its own", async () => {
    const calls = fakeBoat();
    const t = convexTest(schema, modules);

    const first = await t.action(api.lifecycle.create, owner);
    expect(first).toMatchObject({ sandboxId: "bx_23456789", state: "provisioning" });
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.headers["Idempotency-Key"]).toMatch(/[0-9a-f-]{36}/);
    expect(post.headers.Authorization).toBe("Bearer boat_test");

    // Second create with the same key: no new POST, just a refresh.
    await t.action(api.lifecycle.create, owner);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);

    // The scheduled settle poll moves the reactive record without the app doing anything.
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.query(api.sandboxes.get, owner)).toMatchObject({ state: "idle" });
  });

  test("records Boat errors on the record and hides the idempotency token", async () => {
    fakeBoat();
    const t = convexTest(schema, modules);
    await t.action(api.lifecycle.create, owner);
    await expect(t.action(api.exec.readFile, { ...owner, path: "x" })).rejects.toThrow(/sandbox_not_found/);
    await expect(t.action(api.lifecycle.stop, owner)).rejects.toThrow(/sandbox_not_found/);
    const record = await t.query(api.sandboxes.get, owner);
    expect(record?.lastError).toMatch(/404 sandbox_not_found/);
    expect(record).not.toHaveProperty("token");
  });

  test("exec runs through the linked sandbox", async () => {
    fakeBoat();
    const t = convexTest(schema, modules);
    await t.action(api.lifecycle.create, owner);
    expect(await t.action(api.exec.exec, { ...owner, command: "echo hi" })).toMatchObject({ exitCode: 0, stdout: "hi\n" });
    await expect(t.action(api.exec.exec, { ownerId: "user-2", key: "main", command: "id" })).rejects.toThrow(/No Boat sandbox/);
  });

  test("destroy confirms the exact id and forgets the record", async () => {
    const calls = fakeBoat();
    const t = convexTest(schema, modules);
    await t.action(api.lifecycle.create, owner);
    await t.action(api.lifecycle.destroy, owner);
    const del = calls.find((c) => c.method === "DELETE")!;
    expect(del.headers["X-Ascii-Confirm-Delete"]).toBe("bx_23456789");
    expect(await t.query(api.sandboxes.get, owner)).toBeNull();
  });
});
