# CLAUDE.md — Project Rules for Claude Code

This file tells every Claude Code session what this project is, how to work on it, and what not to do. **Read it first in every session before touching anything.**

---

## 1. What this project is

A public SaaS — a website editor with an AI brain, sold to small businesses and individuals.

**Internal placeholder name:** `northpoint` (lowercase). This is NOT the final product name. The real name will be chosen later. Do not commit any user-facing copy that says "Northpoint" yet — use the placeholder `{{PRODUCT_NAME}}` in user-facing strings so we can search-replace later.

**Read `PLAN.md` and `PHASE_1.md` before starting work in any session.** Those documents are the source of truth for what the product is and what to build next.

---

## 2. Project hygiene rules (non-negotiable)

1. **This is a separate project from existing Jarvis.** Do not import code, configs, or patterns from any other repo. If something feels familiar to existing Jarvis work, that's a sign to write it fresh, not to copy it.
2. **Never commit secrets.** API keys, DB URLs, OAuth secrets go in `.env.local` (gitignored) or in Vercel/Railway env vars. Never in code, never in JSON, never in markdown.
3. **Never create a file when you can edit one.** Prefer editing existing files. Only create new files when there's no logical place to add to an existing one.
4. **Never write to `/mnt/user-data/uploads` or any other read-only mount.**
5. **Run the test suite before declaring a task done.** If tests don't exist for the change, write them.
6. **Run Playwright QA before declaring a UI task done.** See section 7.
7. **Branch naming:** `feature/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`. No `main` work.
8. **One PR per atomic task.** Don't bundle unrelated changes.
9. **Verify the base branch before merging a stacked PR.** When PRs are stacked (PR B opened against feature branch A instead of `main`), GitHub does **not** always auto-retarget B's base to `main` when A merges — and if you click "Merge" while B's base is still A, the changes land in branch A, **not** `main`. That silently leaves `main` missing the work even though the PR shows "merged." Before merging any stacked PR, confirm on the PR page that its **base is `main`** (retarget it if not), and after merging the whole stack, confirm the expected files actually exist on `main`. This bit us once: the editor stack (#23/#24/#25) merged into `feat/e2-editor-persistence` instead of `main`, so `main` was missing the editor route, publishing flow, and public render until a restore PR.

### Handling credentials in chat

When you need to reference an env var value, API key, database URL, or any other credential, refer to it by **name only** (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`). **Never echo the actual value back into chat output** — not in messages, not in commit bodies, not in PR descriptions, not in code comments, not in error explanations. If you need to confirm a value, ask the founder to verify it themselves from their `.env.local` or password manager. Past sessions have had `service_role` keys end up in conversation logs — this rule prevents recurrence.

This applies even when the founder pastes a value to you. Read the value, use it (write it to `.env.local`, run the command that needs it), then discuss only the variable name from that point on.

---

## 3. Tech stack (the only stack)

Pin to these. Do not introduce alternatives without explicit user approval.

| Layer | Tool |
|---|---|
| Monorepo | pnpm + Turborepo |
| Frontend | Next.js (app router, latest stable) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Client state | Zustand for UI state, TanStack Query for server state |
| Backend (CRUD/auth) | Next.js API routes |
| Backend (AI/agents) | **Phase 1:** Vercel AI SDK v6 inside Next.js. **Phase 2:** FastAPI service in `/apps/ai` (Python 3.12+) returns for cross-platform agent orchestration. |
| Database | Postgres via Supabase |
| Auth | Supabase Auth |
| File storage | Supabase Storage |
| Vector DB | Supabase pgvector (when needed, Phase 2+) |
| ORM | Drizzle ORM (TypeScript-first, plays well with Supabase) |
| Editor framework | **Puck** (MIT, React visual editor) — Phase 1 Group E. Section library = Puck components. Puck JSON persisted to Supabase. |
| LLM (primary) | Anthropic API — Sonnet 4.6 default, Opus 4.7 for structural edits |
| LLM (fallback) | OpenAI API |
| Image gen | OpenAI gpt-image-1, called inline from chat — no dedicated UI |
| Hosting (web) | Vercel |
| Hosting (AI service) | Railway — **Phase 2 only.** Not used in Phase 1. |
| Payments | Stripe |
| Email | Resend |
| Browser automation (dev) | Playwright MCP for Claude Code |
| Browser automation (prod QA) | Standard Playwright in GitHub Actions |
| CI/CD | GitHub Actions |

**If you need a library not listed here:** propose it in the PR description, do not silently add it. Avoid adding more than one dependency per PR.

### Editor abstraction (no direct Puck leakage)

The website editor is built on **Puck** in Phase 1. Per the competitive review, Puck has bus-factor risk relative to enterprise alternatives (Plasmic, Builder.io). To make a future swap a contained refactor instead of a codebase-wide rewrite, **all editor logic MUST sit behind a thin interface module** at `/apps/web/lib/editor/` that exposes only generic operations:

- `loadDocument(siteVersionId)` → canonical editor document
- `saveDocument(siteVersionId, doc)` → persisted version
- `renderPreview(doc)` → HTML for the preview iframe
- `applyAIEdit(doc, patch)` → updated document
- `listSections()` → registered section components

**Puck-specific types, imports, and component shapes are forbidden outside `/apps/web/lib/editor/`.** No `import { ... } from '@puckeditor/core'` (the package; previously `@measured/puck`, now deprecated and swapped) in route handlers, components, or AI tool code. The interface module is the only place that knows Puck exists. If we swap to Plasmic, Builder.io, or a custom editor later, the change is contained inside that module.

---

## 4. Repo layout

```
/apps
  /web              # Next.js frontend + API routes
  /ai               # Phase 2 placeholder — FastAPI returns for cross-platform agents
/packages
  /ui               # shared shadcn/ui components
  /types            # shared TypeScript types
  /db               # Drizzle schema, migrations, seed scripts
/infra              # deployment configs
/playwright         # QA test suite + Claude Code playwright skills
/docs
  PLAN.md           # product vision (this is where decisions live)
  PHASE_1.md        # current phase build order
  CLAUDE.md         # this file
  ARCHITECTURE.md   # detailed system design (created in Phase 1)
```

**Where things go:**
- React components: `/apps/web/components/` for app-specific, `/packages/ui/` for reusable
- API routes: `/apps/web/app/api/` (Next.js app router convention)
- Server-side utilities: `/apps/web/lib/`
- Database access: only via `/packages/db/`, never direct SQL elsewhere
- Types: `/packages/types/` for shared, `/apps/web/types/` for app-only
- AI prompts: `/apps/web/prompts/` as separate `.md` files, not inline in code. (Moves back to `/apps/ai/prompts/` in Phase 2 when the Python service returns.)
- Playwright tests: `/playwright/tests/`, organized by feature

---

## 5. Coding conventions

### TypeScript
- Strict mode on, always
- No `any` — use `unknown` and narrow, or define proper types
- Prefer `type` aliases over `interface` except for class shapes
- Functions returning JSX: type the return as `React.ReactElement` or use inference, not `JSX.Element`
- Use `import type` for type-only imports

### React
- Functional components only, hooks for everything
- One component per file, file name matches component name (PascalCase.tsx)
- Server components by default; mark `'use client'` only when needed (state, effects, browser APIs)
- Co-locate component-specific styles/types in the same file
- Extract hooks into `/lib/hooks/` when reused across 2+ components

### Styling
- Tailwind for everything. No CSS modules, no styled-components, no inline `style` except for dynamic values
- Color palette: black, white, and one accent. Use Tailwind defaults (`black`, `white`, `gray-*`) until the design system is locked
- shadcn/ui components copied into `/packages/ui` — modify in place, don't fork
- Mobile-first: always start with the smallest viewport and scale up
- All interactive elements have visible focus states for keyboard accessibility

### Naming
- Files: `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- Functions: `camelCase`
- React components: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database tables: `snake_case` plural (e.g., `profiles`, `sites`)
- API routes: `kebab-case` (e.g., `/api/generate-section`)

### Database
- All migrations via Drizzle, never raw SQL in production code
- Every table has `id` (UUID), `created_at`, `updated_at`
- Soft delete via `deleted_at` (nullable timestamp) — never hard delete user data
- Foreign keys explicit, `ON DELETE` behavior always specified
- **Migration numbering across parallel branches:** Drizzle assigns the next sequential `NNNN_*.sql` based on the local `meta/_journal.json`. When two branches generate `0001_*.sql` independently, whichever merges *first* keeps the number; the *second* must rebase onto main, delete its `0001_*.sql` + snapshot + journal entry, then re-run `pnpm db:generate` so Drizzle produces a clean `0002_*.sql`. Don't try to manually re-number files — the snapshot has to be cumulative against the previous migration, which only `db:generate` produces correctly. Manually re-appended RLS blocks survive the regeneration step (re-paste them into the new file).

---

## 6. AI integration rules

> **Phase 1 implementation:** AI calls happen inside Next.js via **Vercel AI SDK v6** — no separate Python service. The paths below are the Phase 1 canonical locations. When the FastAPI service returns in Phase 2 for cross-platform agent work, the equivalent Python paths (`/apps/ai/clients/*.py`, `/apps/ai/prompts/*.md`, `/apps/ai/config.py`) become canonical and this section will be re-bracketed.

### Calling the LLM
- All Anthropic API calls go through `/apps/web/lib/ai/anthropic.ts` — no direct SDK calls scattered through the codebase. Wraps the provider from `@ai-sdk/anthropic`.
- Same pattern for OpenAI: `/apps/web/lib/ai/openai.ts`.
- Every call has explicit timeout, retry policy, and credit-counting wrapper.
- Model selection lives in `/apps/web/lib/ai/config.ts` — change one constant to swap models everywhere.

### Credit accounting
- Every AI call burns credits. Credits are counted in tokens, with a multiplier per model.
- Wrap every call site with `chargeCredits(userId, modelName, inputTokens, outputTokens)`
- Manual edits (click-to-edit, drag, type, swap image) cost zero credits — never call AI for these
- If a user is out of credits, show a clear upgrade prompt, never silently degrade

### Prompts
- All system prompts live in `/apps/web/prompts/` as separate `.md` files
- Versioned (e.g., `editor-restructure-v3.md`) — bumping the version is a deliberate act
- Never inline a long prompt in code

### Streaming
- All chat responses stream to the client. Never wait for full completion before showing anything.
- Use **Vercel AI SDK v6** streaming primitives (`streamText`, `streamUI`) — handles SSE plumbing, tool calls, and multi-step agents inside Next.js route handlers.
- Set `export const maxDuration = 60` (Hobby tier) or higher (Pro) on streaming routes. Streaming output continues past the deadline once headers are flushed.

### Editor AI (Group E)
- Tools operate on the **editor document** (Puck JSON under the hood, but accessed only via `/apps/web/lib/editor/` per the abstraction rule in §3). Edits are applied as JSON Patch operations (RFC 6902).
- Standard tool set: `read_site_doc`, `read_profile`, `read_draft(name)`, `apply_edit(json_patch)`, `generate_section(description)`, `restructure(instruction)` (Opus 4.7).
- Every AI edit shows a preview diff against the current document before applying. Undo is always available.

---

## 7. Testing & QA (this is how Claude Code knows it didn't break things)

### Unit + integration tests
- Vitest for unit tests, lives next to the code it tests (`Component.test.tsx`)
- Playwright for end-to-end tests, lives in `/playwright/tests/`
- **Run the relevant tests before claiming a task is done.** Never declare success without running tests.

### Playwright MCP (Claude Code's eyes)
Claude Code has access to the Playwright MCP server. **Use it.** Before claiming any UI work is done:

1. Run the dev server locally
2. Use `mcp__playwright__browser_navigate` to load the affected page
3. Use `mcp__playwright__browser_take_screenshot` to see what it actually looks like
4. Compare visually to what the task asked for
5. If it doesn't match, iterate. Don't ship "I think it works."

For Phase 1 deliverables, there are three named workflows:
- **`/screenshot [url]`** — single screenshot, optionally multi-viewport (mobile, tablet, desktop). Use for visual checks.
- **`/walkthrough [url] [flow]`** — click through a defined flow, screenshot each step, report what happened. Use for testing user flows.
- **`/qa [url or PR]`** — full QA agent: run all defined tests, screenshot key views, file structured pass/fail report. Run before merging any PR that touches UI.

These are documented in `/playwright/SKILL.md`.

### CI / GitHub Actions
- Every PR runs: `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit), `pnpm test:e2e` (Playwright)
- Every push to `staging` runs the full QA workflow which posts a pass/fail report comment on the PR with screenshots
- No PR merges without green CI
- The QA workflow file is `/.github/workflows/qa.yml`

### Claude Code tooling (Auto Mode, hooks, settings)
- **Auto Mode** is on for autonomous work batches. Settings live in `.claude/settings.json` (project-scoped). The mode runs Claude through pre-approved tools without prompting per-call, but a built-in classifier still blocks risky/ambiguous actions (e.g. installing a package whose name doesn't match what the user typed).
- When the classifier blocks a legitimate action, retry once with a more specific invocation. If still blocked, note it and skip — don't fight the classifier.
- `.claude/settings.json` also pins the Playwright MCP server (see §7 above) and any project-wide hooks. Treat this file like any other code: review changes via PR, don't paste credentials.
- The founder approves autonomous batches with a single prompt that includes blocker rules, stop conditions, and a structured stop-summary format. Stick to that contract.

---

## 8. Data collection (training pipes)

We're collecting data for future training but **not training anything yet**. The collection pipeline must exist so we don't lose data, but no models are fine-tuned on it.

What we collect:
- Every chat message (user + AI) with site context
- Every edit operation (before state, after state, intent if known)
- Every screenshot taken by QA
- Every error from AI calls
- Every credit-spend event

What we do NOT collect:
- PII beyond what's already in user accounts
- Anything from users who opt out (toggle in account settings)
- Anything containing payment info, passwords, or auth tokens

Storage: separate Supabase project (or separate schema) so production user data and training data are physically isolated.

---

## 9. Working with the user (the founder)

### Communication style
- The founder is technical (mechanical engineering background, AI/web dev experience) but is NOT a software architect by training. Explain trade-offs in plain English, not jargon, when proposing significant decisions.
- He is building this alone. Optimize for things that are easy to maintain and easy to undo. Avoid clever code that only one person understands.
- He hates over-engineering. If you're tempted to add abstraction, pause and ask.

### When to ask vs when to act
- **Act without asking** when the task is well-specified and matches existing patterns
- **Ask** when a decision affects user experience, data shape, or future scope
- **Always ask** before adding a new dependency, framework, or service

### When you finish a task
- Summarize what changed, what files were touched, and what you tested
- If anything is unfinished, say so explicitly with a TODO note in code
- Never claim success when you didn't verify with tests or screenshots

---

## 10. Common gotchas

- **Supabase RLS:** Row-Level Security is on for every user-facing table. New tables MUST have RLS policies. Without them, queries silently return empty results.
- **Next.js server vs client components:** Don't try to use React hooks in a server component. Don't try to access `cookies()` in a client component. If unsure, default to server and mark `'use client'` only when something breaks.
- **Stripe webhooks:** Always verify the signature. Never trust the body without verification.
- **AI streaming + Vercel timeouts (Phase 1):** Vercel AI SDK v6 handles streaming inside Next.js route handlers. Set `export const maxDuration = 60` (Hobby tier) or `300` (Pro) on streaming routes — streaming output continues past the deadline once headers are flushed, so most chat interactions fit fine. For Phase 1, this covers everything in Groups E and F (editor chat, hours-update chat). **Phase 2 caveat:** when multi-platform agent orchestration (GBP + Yelp + Instagram + …) needs to run longer than Vercel's hard cap, that work moves to the FastAPI service on Railway.
- **Tailwind purging:** Dynamic class names (e.g., `text-${color}-500`) don't get included in production. Use full class names with conditionals.

---

## 11. Phase awareness

Look at `PHASE_1.md` to see what's currently being built. **Do not build Phase 2+ features unless explicitly asked.** Resist scope creep — even if "while I'm here I could also add X" feels efficient, it isn't.

### Phase 1 scope adjustments (per the strategic pivot)
- **Single-tenant alpha** — BC Glass & Tint is the only real account; the founder is the admin. **No signup form, no auth UI for new users.** Customer #2 onboarded via SQL. Signup form returns when we hit customer #5.
- **Business-only onboarding** — Personal flow is documented in `PLAN.md` §5 but deferred to Phase 2. The `profiles.type` column ships in Phase 1 so this is schema-additive (no migration needed in Phase 2).
- **Editor built on Puck** — see Group E in `PHASE_1.md`. **Group E starts with a 1–2 day integration spike (E1) with a hard go/no-go.** If Puck fights us, fall back to a custom editor (12–14 day estimate vs the 10-day Puck path). Do not start E2+ until the spike passes. All editor code sits behind `/apps/web/lib/editor/` per the abstraction rule in §3.
- **No FastAPI service in Phase 1** — Vercel AI SDK v6 in Next.js covers Phase 1's AI needs. `/apps/ai/` is preserved as an empty Phase 2 placeholder. Do not re-introduce FastAPI without the founder explicitly reopening A5/A8.
- **GBP atomic-hours demo (new Group F)** — pulled forward from Phase 2. End-of-June 2026 target. Northpoint is source of truth; GBP-side conflict detection is Phase 2.

---

## 12. When you're stuck

If you've tried something twice and it isn't working:
1. Stop iterating on the failing approach
2. Use the Playwright MCP to actually look at the page and see what's happening
3. Check the database state directly if it's a data issue
4. Ask the founder for clarification rather than guessing

Hours of guessing > 30 seconds of asking.

---

## 13. Version

This file is at v1.3. Update the version number when making significant changes. The founder is the only person who approves changes to this file.

**Changelog:**
- **v1.3** — Added §2 rule 9: verify a stacked PR's base is `main` before merging (GitHub doesn't always auto-retarget), after a stack merged into the wrong base and left `main` missing the editor route / publishing / public render.
- **v1.2** — Documented Drizzle migration numbering convention for parallel branches (collisions resolved via rebase + regenerate, not manual renumber). Updated Puck package reference from deprecated `@measured/puck` to `@puckeditor/core`. Added §7 subsection on Claude Code Auto Mode + `.claude/settings.json` + classifier behavior.
- **v1.1** — Strategic pivot: drop FastAPI for Phase 1 (Vercel AI SDK v6 replaces it inside Next.js), build editor on Puck (MIT) starting with a go/no-go spike, single-tenant alpha (no signup form), business-only onboarding (Personal deferred to Phase 2, schema-additive), GBP atomic-hours demo added as new Group F. Editor abstraction rule added so Puck swap stays contained.
- **v1.0** — Initial CLAUDE.md.
