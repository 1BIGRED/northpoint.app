# Playwright SKILL

Reference for the three named browser-automation workflows referenced in `CLAUDE.md` §7. **These are prompt patterns, not implementations** — the actual end-to-end test files arrive later in Phase 1 Group F.

Until that lands, the workflows below describe what to ask a Claude Code session to do when you want a screenshot, a flow walkthrough, or a QA pass. They drive the Playwright MCP server that this PR (A4) wires up.

---

## How this works

The Playwright MCP server is configured at the repo root in `.mcp.json` (project scope). When a Claude Code session starts in this directory, it discovers the server and (after you approve it once) exposes browser-control tools — navigate, click, fill, screenshot, etc. — that the model can call directly.

Run `pnpm exec playwright install chromium` once after `pnpm install` to ensure the browser binary is present in `~/.cache/ms-playwright/`. The lockfile pins `playwright` so versions stay in sync.

### Activation (do this once)

1. Pull this branch and run `pnpm install` — adds `@playwright/mcp` and `playwright` to the lockfile, and downloads chromium.
2. **Restart Claude Code** so it picks up the new `.mcp.json`. (MCP configs are read at session start; an already-running session won't see a new server until restart.)
3. On first invocation Claude Code prompts you to trust the project-scoped MCP server. Approve it.
4. Confirm it's wired up by running `claude mcp list` in your shell, or `/mcp` inside a Claude Code session — `playwright` should appear in the list.

If `playwright` doesn't show up, common causes:
- You're in the wrong working directory (`.mcp.json` is only loaded when Claude Code starts from a directory that contains it, or an ancestor of one).
- You didn't restart Claude Code.
- You declined the trust prompt — `claude mcp reset-project-choices` clears it.

---

## Workflow 1: `/screenshot [url]`

**Prompt pattern.** Used for visual checks against a single page.

> `/screenshot http://localhost:3000/some-route`
> `/screenshot http://localhost:3000/some-route --viewports mobile,desktop`

The session should:
1. Verify the URL is reachable (HTTP 200 / 3xx). If not, surface the error and stop.
2. Open it in the MCP-controlled browser.
3. Take a screenshot at the default desktop viewport (1280×800).
4. If `--viewports` is provided, take one per requested viewport. Default named viewports:
   - `mobile` = 375×812 (iPhone-class)
   - `tablet` = 768×1024
   - `desktop` = 1280×800
5. Save under `/playwright/artifacts/screenshots/<timestamp>-<route-slug>-<viewport>.png` (gitignored — see `.gitignore` entry to be added when artifacts directory is used).
6. Inline the screenshots in the chat reply so the result is reviewable without leaving the session.

Use case: "I just changed the marketing page hero — show me what it looks like on mobile and desktop."

---

## Workflow 2: `/walkthrough [url] [flow]`

**Prompt pattern.** Used to test a defined user flow end-to-end and capture every step.

> `/walkthrough http://localhost:3000 signup`
> `/walkthrough http://localhost:3000 onboarding --headed`

The session should:
1. Start at `url`.
2. Look up the named `flow` (e.g. `signup`, `login`, `onboarding`, `editor-restructure`) from `/playwright/flows/<flow>.md` once those files exist — for now, expand it inline from the prompt.
3. For each step, perform the action via MCP, then screenshot.
4. Report at the end: which steps succeeded, which failed, screenshot indexes, and the final URL.

Use case: "Walk through the signup flow with invite code `TESTING123` and tell me where it breaks."

---

## Workflow 3: `/qa [url or PR]`

**Prompt pattern.** Used as the gate before merging any UI-touching PR (`CLAUDE.md` §7).

> `/qa http://localhost:3000`
> `/qa #42`

The session should:
1. If passed a PR number, check out the PR branch locally; otherwise use the current working tree.
2. Start the dev server (`pnpm --filter @northpoint/web dev`) if not already running.
3. Run every flow defined under `/playwright/flows/`.
4. Screenshot all key views at all default viewports.
5. Report a structured pass/fail summary in the chat reply, with screenshots inlined for failures.
6. On a PR, the production version of this (`/.github/workflows/qa.yml`, to be added later in Phase 1) will post the same report as a PR comment.

Use case: "Run QA against PR #42 before I merge it."

---

## Why these are prompt patterns and not code right now

Per `CLAUDE.md` §11 and `PHASE_1.md` Group F, the actual Playwright test suite (`/playwright/tests/`, `/playwright/flows/`) is built later. A4's job is just to make the Playwright MCP usable from a Claude Code session today, so that subsequent UI-focused PRs (A2 follow-ups, B-series auth pages, etc.) can be visually verified by asking the model directly. The structured test files arrive once there are stable flows worth pinning.

---

## File layout (current and planned)

```
/playwright
  SKILL.md            # this file
  flows/              # TODO (Group F): one .md per named flow
  tests/              # TODO (Group F): Playwright test files
  artifacts/          # gitignored — screenshots, traces from local runs
```

Only `SKILL.md` exists today. The other directories are placeholders the workflows above will populate as Phase 1 progresses.
