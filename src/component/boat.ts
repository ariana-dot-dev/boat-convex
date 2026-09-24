import { env } from "./_generated/server.js";

export const DEFAULT_API_URL = "https://boat.dev/api/v1";

export class BoatApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(`Boat API ${status} ${code}: ${message}`);
    this.name = "BoatApiError";
  }
}

export type BoatSandbox = {
  id: string;
  name: string;
  state: string;
  [key: string]: unknown;
};

/** Calls the Boat public API. Reads the key per call: module scope runs at deploy analysis, where env is unset. */
export async function boat<T = Record<string, unknown>>(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const base = (env.BOAT_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.BOAT_API_KEY}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text.slice(0, 500) };
  }
  if (!response.ok || json.ok === false) {
    const error = (json.error ?? {}) as Record<string, unknown>;
    throw new BoatApiError(
      response.status,
      String(json.code ?? error.code ?? "boat_api_error"),
      String(json.message ?? error.message ?? response.statusText),
    );
  }
  return json as T;
}

export const sandboxPath = (sandboxId: string, suffix = "") =>
  `/sandboxes/${encodeURIComponent(sandboxId)}${suffix}`;

/** Keep only the fields the schema caches; Boat's payload is extensible and Convex validators are strict. */
export function summarize(sandbox: BoatSandbox) {
  const pick = (key: string) => {
    const value = sandbox[key];
    return typeof value === "string" || value === null ? value : undefined;
  };
  const out: Record<string, unknown> = {
    id: sandbox.id,
    name: sandbox.name,
    state: sandbox.state,
  };
  for (const key of [
    "type",
    "url",
    "ip",
    "subdomain",
    "archiveAfter",
    "createdAt",
    "updatedAt",
    "snapshotCompletedAt",
    "setupStatus",
    "setupError",
  ]) {
    const value = pick(key);
    if (value !== undefined && !(key === "type" && value === null)) out[key] = value;
  }
  if (typeof sandbox.snapshotAvailable === "boolean") {
    out.snapshotAvailable = sandbox.snapshotAvailable;
  }
  return out as {
    id: string;
    name: string;
    state: string;
    type?: string;
    url?: string | null;
    ip?: string | null;
    subdomain?: string | null;
    archiveAfter?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    snapshotAvailable?: boolean;
    snapshotCompletedAt?: string | null;
    setupStatus?: string | null;
    setupError?: string | null;
  };
}

/** States a sandbox passes through on its way to a settled one. */
export const TRANSITIONAL = new Set([
  "creating",
  "init",
  "provisioning",
  "provisioned",
  "cloning",
  "archiving",
]);

export function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2_000);
}
