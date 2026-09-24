import { defineApp } from "convex/server";
import { v } from "convex/values";
import boat from "@boatdev/convex/convex.config.js";

const app = defineApp({ env: { BOAT_API_KEY: v.string() } });
app.use(boat, { env: { BOAT_API_KEY: app.env.BOAT_API_KEY } });
export default app;
