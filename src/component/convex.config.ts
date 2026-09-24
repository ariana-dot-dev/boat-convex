import { defineComponent } from "convex/server";
import { v } from "convex/values";

export default defineComponent("boat", {
  env: {
    BOAT_API_KEY: v.string(),
    BOAT_API_URL: v.optional(v.string()),
  },
});
