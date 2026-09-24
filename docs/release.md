# Releasing `@boatdev/convex`

Publish from a maintainer's computer, never from an agent or CI.

```sh
git checkout main && git pull --ff-only
npm ci
npm test
# Real sandboxes on your Boat account (about 1 minute, all deleted at the end):
CONVEX_AGENT_MODE=anonymous npx convex init        # first time only
npx convex env set BOAT_API_KEY boat_...           # first time only
npx convex dev --once && (npx convex dev &) && npm run e2e
npm run build && npm pack --dry-run
npm version patch
npm publish --access public
git push --follow-tags
```

Then list it in the Convex directory: run the preflight at https://www.convex.dev/components/submit/check and
submit at https://www.convex.dev/components/submit (public repo + npm package required).
