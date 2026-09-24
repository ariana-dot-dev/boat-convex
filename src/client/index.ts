import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
  GenericActionCtx,
  GenericDataModel,
  GenericQueryCtx,
} from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type ActionCtx = Pick<GenericActionCtx<GenericDataModel>, "runAction" | "runQuery">;

/** Every call names a sandbox by (ownerId, key). Your app picks both; derive ownerId from ctx.auth, never from the browser. */
export type SandboxRef = { ownerId: string; key: string };

type Args<F extends FunctionReference<"action" | "query", "internal">> = FunctionArgs<F>;
type Ret<F extends FunctionReference<"action" | "query", "internal">> = Promise<FunctionReturnType<F>>;
type Api = ComponentApi;

/**
 * Boat sandboxes from Convex. Keep one instance in your `convex/` folder:
 *
 *   export const boat = new Boat(components.boat);
 *
 * `get`/`list` are reactive queries; everything else runs from actions.
 */
export class Boat {
  constructor(public readonly component: ComponentApi) {}

  get(ctx: QueryCtx, args: SandboxRef): Ret<Api["sandboxes"]["get"]> {
    return ctx.runQuery(this.component.sandboxes.get, args);
  }
  list(ctx: QueryCtx, args: Args<Api["sandboxes"]["list"]>): Ret<Api["sandboxes"]["list"]> {
    return ctx.runQuery(this.component.sandboxes.list, args);
  }

  /** Create, or return the sandbox already created for this key. Retry-safe. */
  create(ctx: ActionCtx, args: Args<Api["lifecycle"]["create"]>): Ret<Api["lifecycle"]["create"]> {
    return ctx.runAction(this.component.lifecycle.create, args);
  }
  refresh(ctx: ActionCtx, args: SandboxRef): Ret<Api["lifecycle"]["refresh"]> {
    return ctx.runAction(this.component.lifecycle.refresh, args);
  }
  /** Snapshot the disk and stop billing. `resume` brings it back exactly as it was. */
  stop(ctx: ActionCtx, args: Args<Api["lifecycle"]["stop"]>): Ret<Api["lifecycle"]["stop"]> {
    return ctx.runAction(this.component.lifecycle.stop, args);
  }
  resume(ctx: ActionCtx, args: Args<Api["lifecycle"]["resume"]>): Ret<Api["lifecycle"]["resume"]> {
    return ctx.runAction(this.component.lifecycle.resume, args);
  }
  /** Copy a sandbox, disk and all, into a new one under `newKey`. */
  fork(ctx: ActionCtx, args: Args<Api["lifecycle"]["fork"]>): Ret<Api["lifecycle"]["fork"]> {
    return ctx.runAction(this.component.lifecycle.fork, args);
  }
  /** Permanently delete the sandbox and its snapshots. Irreversible. */
  destroy(ctx: ActionCtx, args: SandboxRef): Ret<Api["lifecycle"]["destroy"]> {
    return ctx.runAction(this.component.lifecycle.destroy, args);
  }

  exec(ctx: ActionCtx, args: Args<Api["exec"]["exec"]>): Ret<Api["exec"]["exec"]> {
    return ctx.runAction(this.component.exec.exec, args);
  }
  spawn(ctx: ActionCtx, args: Args<Api["exec"]["spawn"]>): Ret<Api["exec"]["spawn"]> {
    return ctx.runAction(this.component.exec.spawn, args);
  }
  commandStatus(ctx: ActionCtx, args: Args<Api["exec"]["commandStatus"]>): Ret<Api["exec"]["commandStatus"]> {
    return ctx.runAction(this.component.exec.commandStatus, args);
  }
  readFile(ctx: ActionCtx, args: Args<Api["exec"]["readFile"]>): Ret<Api["exec"]["readFile"]> {
    return ctx.runAction(this.component.exec.readFile, args);
  }
  writeFile(ctx: ActionCtx, args: Args<Api["exec"]["writeFile"]>): Ret<Api["exec"]["writeFile"]> {
    return ctx.runAction(this.component.exec.writeFile, args);
  }
  host(ctx: ActionCtx, args: Args<Api["exec"]["host"]>): Ret<Api["exec"]["host"]> {
    return ctx.runAction(this.component.exec.host, args);
  }
  prompt(ctx: ActionCtx, args: Args<Api["exec"]["prompt"]>): Ret<Api["exec"]["prompt"]> {
    return ctx.runAction(this.component.exec.prompt, args);
  }
  promptStatus(ctx: ActionCtx, args: Args<Api["exec"]["promptStatus"]>): Ret<Api["exec"]["promptStatus"]> {
    return ctx.runAction(this.component.exec.promptStatus, args);
  }
  events(ctx: ActionCtx, args: Args<Api["exec"]["events"]>): Ret<Api["exec"]["events"]> {
    return ctx.runAction(this.component.exec.events, args);
  }
}
