# PHASE_1.md — Editor + atomic-hours demo on BC Glass & Tint

> **Goal:** Ship a website editor that's actually good, prove it on a real customer (BC Glass & Tint), and demo the atomic-update differentiator.
> **Targets:**
>  - BC Glass & Tint running on the Northpoint editor by **mid-June 2026**
>  - "Change my hours → website + GBP atomically" demo recorded by **end of June 2026**
> **Estimated duration:** 5–6 weeks of focused work
> **Done when:** BC Glass & Tint's current site is imported, editable via click + chat, published to bcglassandtint.com (or a Northpoint subdomain), and the atomic hours-update demo works end-to-end on real data.
>
> **Scope vs original plan:** single-tenant alpha (no invite-code flow yet), business-only onboarding (Personal deferred to Phase 2), editor built on Puck behind an abstraction module (~1 week saved, with a go/no-go spike up front), Vercel AI SDK v6 replaces FastAPI for Phase 1, GBP integration pulled forward from Phase 2.

This is the dependency-ordered build list. Do these in order. Don't skip ahead even if something later seems easier.

---

## Group A — Foundation (Days 1–3)

These have no dependencies. Do them first, in any order.

> **Status: DONE.** All Phase 1 items merged: A1, A2, A3, A4, A6, A7. A5 (FastAPI) and A8 (Railway) **deferred to Phase 2** per the strategic pivot — Vercel AI SDK v6 inside Next.js handles streaming, tool calls, and multi-step agents for the Phase 1 editor. FastAPI returns in Phase 2 when cross-platform agent orchestration needs Python.

### A1. Create the GitHub repo and bootstrap the monorepo
- Private repo, owner: you
- Initialize with pnpm + Turborepo
- Add `/apps/web`, `/apps/ai`, `/packages/ui`, `/packages/db`, `/packages/types`
- Configure pnpm workspaces and Turborepo pipeline
- Add `.gitignore`, `.editorconfig`, basic README
- **Acceptance:** `pnpm install` works, `pnpm dev` runs both web and ai stubs

### A2. Configure Next.js with TypeScript + Tailwind + shadcn/ui
- Next.js latest stable, app router, TypeScript strict mode
- Tailwind v4 with custom config (black/white palette, Inter font)
- shadcn/ui init, copy in: button, input, label, card, dialog, dropdown-menu, toast
- **Acceptance:** Hello-world page renders with Tailwind styling

### A3. Configure Supabase
- New Supabase project, region: us-west (Vegas-adjacent)
- Capture connection string, anon key, service role key into `.env.local`
- Enable email auth and Google OAuth
- **Acceptance:** Supabase dashboard reachable, env vars set, anon client connects from a test page

### A4. Set up Playwright MCP for Claude Code
- Install `@playwright/mcp` per Claude Code MCP docs
- Add config to `.claude/settings.json`
- Verify `/mcp` slash command in Claude Code shows Playwright tools available
- Create `/playwright/SKILL.md` documenting the three commands: `/screenshot`, `/walkthrough`, `/qa`
- **Acceptance:** Claude Code in this repo can navigate to a URL and take a screenshot

### A5. Set up FastAPI stub
**Status: DEFERRED to Phase 2.** Vercel AI SDK v6 in Next.js covers Phase 1's AI needs (streaming, tool calls, multi-step agents) without a second language and second deploy target. The FastAPI service returns in Phase 2 when cross-platform agent orchestration (GBP, Instagram, Facebook, Yelp) benefits from the Python ecosystem.

The `apps/ai/` folder is preserved in the repo as an empty Phase 2 placeholder.

### A6. Set up GitHub Actions CI
- Workflow that runs on every PR: typecheck, lint, unit test, e2e test
- Workflow that runs on push to `staging`: full QA agent + screenshots posted on PR
- **Acceptance:** Open a junk PR, watch all jobs pass

### A7. Set up Vercel deployment for `/apps/web`
- Connect repo to Vercel
- Configure preview deploys per PR, production deploy on `main`
- Wire up env vars from Vercel dashboard
- **Acceptance:** A PR auto-deploys to a preview URL

### A8. Set up Railway deployment for `/apps/ai`
**Status: DEFERRED to Phase 2.** Follows A5 — no FastAPI service to host in Phase 1.

---

## Group B — Auth + Accounts (Days 4–6)

Depends on Group A.

> **Status: in progress, mostly done.** B1 (DB schema) and B3 (magic-link login + callback + middleware + stubs) merged. B4 was rolled into B3's middleware. B5 (manual SQL provisioning of the two accounts) is the only remaining gate before Group C — it's a one-time human action in the Supabase SQL editor (the snippet lives in PR #13's body). B2 and B7 (signup + invite codes) remain Phase 2.

### B1. Database schema v1 (Drizzle) — **DONE** (PR #12, migration `0000_majestic_skin.sql` applied 2026-05-27)
Tables:
- `users` (id = FK to `auth.users.id`, email, role enum [admin|user], created_at, updated_at, deleted_at)
- `accounts` (id, user_id = FK to `users.id`, type enum [admin|client], created_at, updated_at, deleted_at) — for the two-account setup
- ~~`invite_codes`~~ — *deferred to Phase 2 (multi-tenant). Not needed for single-tenant alpha.*
- RLS enabled on both tables. Initial policies: authenticated user can `SELECT` their own row only. Writes are service-role only until B3 wires up specific app-side flows.
- **Acceptance:** Migrations run clean, both tables + enums visible in Supabase dashboard, RLS shows enabled.

### B2. Sign up flow with invite code gating
**Status: DEFERRED to Phase 2 (multi-tenant launch).** Phase 1 is single-tenant alpha — BC Glass & Tint is the only real account, and B5 provisions accounts manually in Supabase. The signup form returns when we hit customer #5, alongside the invite-code admin tool (B7).

### B3. Login flow (magic-link only) — **DONE** (PR #13)
- `/login` page: single email input → "Send magic link" button
- Submit calls Supabase `signInWithOtp({ email })` from a Next.js server action / route handler
- Confirmation screen: "Check your email — we sent a link to `<email>`"
- Email link → Supabase auth callback at `/auth/callback?code=…` → exchange code for session → redirect by role: `admin` → `/admin`, `user` → `/app`
- A DB trigger on `auth.users` insert populates `public.users` with the role from app metadata (default `user`); RLS lets the freshly-authenticated session read that row.
- **Email delivery:** Supabase default SMTP for Phase 1 alpha. **Resend swap is a separate PR scheduled before Group G's BC Glass & Tint launch + demo recording** — track this as a known dependency.
- **Google OAuth deliberately omitted from Phase 1.** Rationale: zero benefit for the single-tenant alpha (founder + BC Glass & Tint owner are the only humans logging in), ~4–6 hours of work for OAuth consent screen + redirect URI wiring across local/preview/prod. Revisit in Phase 2 if real signups need it.
- **Acceptance:** Founder enters their email at `/login`, receives magic link, clicks it, lands at `/admin` (admin role) or `/app` (user role) based on their `users.role`.

### B4. Auth middleware — **DONE** (folded into PR #13's `proxy.ts`)
- Next.js middleware that protects `/admin/*` (admin role only) and `/app/*` (authenticated user)
- Unauthenticated visits → redirect to `/login` with return URL
- Wrong-role visits → 403 page with link to correct destination
- **Acceptance:** Direct URL access to `/admin` as a user redirects appropriately

### B5. Generate your two accounts — pending (manual SQL in Supabase)
- Manually create the admin row (founder's email) via SQL in Supabase: insert into `auth.users` (via Supabase dashboard's user management UI), then set `public.users.role = 'admin'` and insert matching `public.accounts` row with `type = 'admin'`.
- Same for the client row (BC Glass & Tint owner's email): `users.role = 'user'`, `accounts.type = 'client'`.
- No email verification step — the magic link itself is the verification.
- **Acceptance:** Both rows visible in Supabase. Sending a magic link to either email lands the user at the correct page (`/admin` or `/app`).

### B6. Add "Switch to client account" button in admin nav
- Top-right button in `/admin` layout
- Opens `/app` in a new tab using the client account's session (or a magic-link-style mechanism — keep it simple)
- **Acceptance:** One click opens your client account in a new tab

### B7. Generate first batch of invite codes
**Status: DEFERRED to Phase 2.** Follows B2 — no signup form, no invite codes needed in single-tenant alpha. Customer #2 will be SQL-provisioned.

---

## Group C — Profile + Onboarding (Days 7–10)

Depends on Group B.

### C1. Database schema v2 — **partially DONE** (PR #14)
Tables:
- `profiles` — id, account_id (FK accounts.id), name (text), `type` (text + CHECK `IN ('business', 'personal')`, default `'business'`), `data` (jsonb default `'{}'`), timestamps, deleted_at. **Note:** the v1 schema in PR #14 ships the flexible `data` jsonb bag rather than the originally-planned structured columns (industry, city, state, zip, phone, etc.). Onboarding (C2+) populates `data.*` keys; if specific columns become hot-paths we can add them in a follow-up migration without breaking anything.
- **Acceptance:** Migration applied, profiles can be inserted via SQL. RLS: account-owner SELECT + UPDATE their own profile.

### C2. Onboarding scaffolding
- `/onboarding` route, gated: only first-time users with no profile land here
- Step component pattern: each step is a separate component, state managed in a wizard wrapper. **Phase 1: skip the Account Type fork — every user enters the Business flow directly.**
- Progress bar at top
- Skip button on every step except Basics (Account Type step is hidden in Phase 1)
- **Acceptance:** Visit `/onboarding` after signup, see business step 1 (Basics)

### C3. Step 1 — Account type
**Status: DEFERRED to Phase 2.** Phase 1 is business-only. The fork returns in Phase 2 when the Personal flow ships. The `profiles.type` column is included in C1 from day one so this is schema-additive (no migration needed in Phase 2).

### C4. Business flow steps 2–7
- Basics, Contact, What You Do, Brand, Integrations (skip-only at launch), Done
- Each step saves to draft profile on Next
- Forms use react-hook-form + zod for validation
- ✨ button next to free-text fields that calls the AI service to generate a suggestion based on prior steps' data
- **Acceptance:** Complete the full business flow, profile row exists in DB with all data, lands at /app

### C5. Personal flow steps 2–6
**Status: DEFERRED to Phase 2.** The Personal product UX is documented in `PLAN.md` §5 and the schema is ready for it (`profiles.type = 'personal'`). Phase 1 is business-only.

### C6. Profile page at `/app/profile`
- Same data, same form, ungated. Read + edit.
- Save button updates the profile
- **Acceptance:** Edit a field, save, refresh, see the new value

### C7. AI assist endpoint
- POST `/api/ai/assist-onboarding-field` *(Next.js route, not FastAPI)*
- Input: field name, prior profile data
- Output: 1–3 suggestions
- Implemented via **Vercel AI SDK v6** wrapping an Anthropic Sonnet 4.6 call. Prompts live in `/apps/web/prompts/onboarding-assist-v1.md` (moved from the old `/apps/ai/prompts/` location since there's no separate AI service in Phase 1).
- Burns credits (small amount per call)
- **Acceptance:** Click ✨ on Services field after filling in industry, get plausible service suggestions

---

## Group D — Site Storage + Import (Days 11–13)

Depends on Group C.

### D1. Database schema v3
Tables:
- `sites` (id, profile_id, name, slug, subdomain, custom_domain, status enum [draft|published|paused], created_at, updated_at, deleted_at)
- `site_versions` (id, site_id, version_number, name, html, css, assets_json, is_published, is_autosave, created_at)
- `chat_messages` (id, site_id, role enum [user|assistant], content, tokens_used, created_at)
- **Acceptance:** Migrations clean

### D2. Create a default site on profile creation
- When a profile is created via onboarding, also create a default `sites` row
- If they entered an existing website URL → trigger import (D3 below) immediately
- If not → create with a blank template
- **Acceptance:** Profile creation results in exactly one `sites` row, one initial `site_versions` row

### D3. Import-as-is service
- POST `/api/ai/import-site` *(Next.js route)*
- Input: URL. **Phase 1 calibration target: BC Glass & Tint's current site.**
- Output: extracted HTML, CSS, image URLs, structure metadata
- Implementation: server-side fetch + cheerio/jsdom to clean up, inline critical CSS, rewrite asset URLs to absolute
- **Do not improve.** Store imported content verbatim.
- **Acceptance:** Paste BC Glass & Tint's current URL, see imported HTML stored in `site_versions`

### D4. Subdomain provisioning
- **Phase 1 simplified:** start by serving a single hardcoded subdomain (`bcglassandtint.northpoint-app.com`) and prove the round-trip works. Generalize to wildcard `*.northpoint-app.com` after BC Glass & Tint is live.
- When a site is created, assign a slug from profile name (slugified, collision-suffixed)
- **Acceptance:** BC Glass & Tint's site is reachable at `bcglassandtint.northpoint-app.com`

### D5. Custom domain connection (basic)
- Settings page: enter custom domain, get CNAME instructions
- DNS check API that polls until the domain points correctly
- Once verified, the published site serves on the custom domain too
- **Acceptance:** Connect a real test domain, verify it serves the site

---

## Group E — The Editor (Days 14–24, ~10 days on Puck path; 12–14 days on fallback)

Depends on Group D.

> **Implementation: built on Puck** (MIT-licensed React visual editor). Section library registers as Puck components. Puck's structured JSON is the canonical site representation, persisted to Supabase `site_versions.json`. HTML is rendered from JSON at request time (for preview and publish). AI chat operates on Puck JSON, not raw HTML — structural edits become tractable and undoable.
>
> **All editor code sits behind `/apps/web/lib/editor/`** per the abstraction rule in CLAUDE.md §3. No `import { ... } from '@measured/puck'` anywhere outside that module. Routes, components, and AI tools call the interface (`loadDocument`, `saveDocument`, `renderPreview`, `applyAIEdit`, `listSections`) — they don't know Puck exists.
>
> **Spike-first.** E1 is a 1–2 day Puck integration spike with a hard go/no-go decision at its end. If Puck supports the four critical needs (custom components for our section library, embeddable in a Next.js client route, programmatic JSON editing for AI chat to use, server-side HTML render from JSON for publish), Group E continues at the 10-day budget. If any of those four fails, Group E falls back to a custom click-to-edit editor and slips to 12–14 days. Do not start E2+ until E1 passes.

### E1. Puck integration spike (Days 14–15, hard go/no-go)
- Install Puck in `/apps/web` and embed in a throwaway `/dev/puck-spike` route
- Stand up the first cut of `/apps/web/lib/editor/` interface module so the spike code already exercises the abstraction boundary — even if the implementation is one-line passthroughs to Puck
- Build one custom "Hero" Puck component matching the shape our section library will need (props, defaults, render function)
- Edit it in the Puck UI, save the resulting Puck JSON to a local file
- Render that JSON back to static HTML via Puck's render API on a server route
- Programmatically apply a JSON Patch to the Puck doc (simulate what AI chat will do) — confirm the UI reflects the change
- **Go/no-go at end of day 15:**
  - **Go:** all four work cleanly → proceed to E2+ as planned
  - **No-go:** any one fails badly → tear out Puck, mark Group E as "Custom editor (12–14 days)", report back to founder with the specific failure mode before proceeding
- **Acceptance:** A short writeup in the PR description recording which path Group E is taking and why

### E2. Editor shell layout
- `/app/sites/[id]/edit` route
- Three-pane layout: left (pages + drafts panel), center (editor + preview, via `/apps/web/lib/editor/`), right (AI chat panel)
- Top bar: Save, Preview, Publish, Basic↔Advanced toggle, viewport toggle (mobile/tablet/desktop), back button
- Collapsible panels for screen real estate
- **Acceptance:** Visit the route, see all three panels with placeholder content

### E3. Live preview
- Center pane renders the editor's preview mode via `renderPreview(doc)` from the interface module
- Preview updates live as the editor JSON changes
- Viewport toggle changes preview width: 375 / 768 / 1280
- **Acceptance:** Edit a section, see preview update; toggle viewport, see preview resize

### E4. Click-to-edit foundation (text)
- Puck handles text editing natively; we register text-field types and brand-color palette
- Floating toolbar shows: font size, color (palette from brand colors), bold, italic, alignment, link
- Edits write to the editor JSON via `applyAIEdit` (or its manual-edit equivalent) on the interface module
- **Acceptance:** Click an h1, change its text and color, see it update in the preview and persist to DB

### E5. Click-to-edit for images
- Custom Puck field for image swap: replace from URL, upload (Supabase Storage), AI generate (burns credits), alt text, delete
- **Acceptance:** Replace an image via upload, see new image in the preview

### E6. Click-to-edit for sections
- Sections are Puck components with native reorder/duplicate/delete handles
- "+ Add Section" buttons appear between sections
- "AI improve this section" button per section
- **Acceptance:** Reorder two sections via drag, see new order persist

### E7. Section library = Puck component registry
- Each library category (Hero, About, Services, Gallery, Testimonials, FAQ, CTA, Contact, Footer) registers 3–5 Puck components via `listSections()`
- "+ Add Section" opens a side panel listing the registry, grouped by category
- Click a component → inserts at the position the + was clicked
- AI section button at top of panel: text input → AI generates a custom section config in the site's existing style
- **Acceptance:** Add a "Services" section from the library, see it appear; use AI custom: "add a section about our financing options"

### E8. Save / Preview / Publish
- **Save button:** opens a "Name this draft" modal, calls `saveDocument` → new `site_versions` row with name + editor JSON
- **Preview button:** opens current state in a new tab on a `/preview/[siteId]?version=draft` URL (server-renders HTML from the editor JSON via `renderPreview`)
- **Publish button:** marks current draft as the published version, propagates to subdomain + custom domain; if user's hosting is external, generates an HTML export download
- **Acceptance:** Save a named draft, see it in drafts panel; preview opens new tab; publish makes the site live

### E9. Drafts panel
- Left sidebar: list of saved drafts with name, timestamp, thumbnail (screenshot via Playwright at save time)
- Click a draft → calls `loadDocument` with that version, replaces editor state (with confirmation if current has unsaved changes)
- Delete option per draft
- **Acceptance:** Save 3 drafts, switch between them, delete one

### E10. AI chat in editor
- Right panel: standard chat UI
- Streaming responses via **Vercel AI SDK v6** (`streamText`) inside a Next.js route handler
- The AI has tools available — all operate on the editor JSON via the interface module, not raw HTML:
  - `read_site_doc()` — get current draft as editor JSON
  - `read_profile()` — get business profile
  - `read_draft(name)` — get a named draft's editor JSON
  - `apply_edit(json_patch)` — apply a JSON Patch (RFC 6902) to the current draft via `applyAIEdit`
  - `restructure(instruction)` — read site, plan, apply structural changes (Opus 4.7)
  - `generate_section(description)` — generate a new section config in current style
- Every AI response that includes an edit shows a diff preview before applying
- Undo button always available
- **Acceptance:** Chat: "change all phone numbers to 702-555-1234" → preview diff → accept → all numbers change

### E11. Basic vs Advanced toggle
- Default: Basic mode. Floating toolbars show simplified options.
- Advanced mode: unlocks raw HTML/CSS slots in Puck components, custom HTML insertion, full layout/spacing controls, code view tab
- Toggle persists per user (in account settings)
- **Acceptance:** Toggle to Advanced, see new options appear; toggle back, see them hide

### E12. Mobile/tablet/desktop viewport-aware AI
- Top-bar buttons set preview width
- AI chat is aware of current viewport when generating sections (responsive by default)
- **Acceptance:** Switch to mobile preview, AI-generated sections respect mobile layout

### E13. Chat-aware draft referencing
**Status: DEFERRED to Phase 2 polish.** *(Was the old E12 — "use the hero from draft 'bold v2' and services from draft 'minimal v4'".)* Nice-to-have, not on the BC Glass & Tint critical path. The `read_draft(name)` tool is already wired in E10, so this can be enabled later by adding chat-side language without further backend work.

---

## Group F — GBP integration + atomic-update demo (Days 25–28)

**Pulled forward from Phase 2.** This is the differentiator and the demo target for end of June 2026.

Depends on Groups C + E.

### F1. Google Business Profile OAuth + read
- "Connect Google Business Profile" button in profile settings
- OAuth scope: `business.manage`
- On connect: pull location, hours, phone, address into a `gbp_locations` table linked to the profile
- **Acceptance:** Connect a real GBP location, see hours/address show up in `/app/profile`

### F2. Google Business Profile write
- API route that takes a partial profile diff and pushes it to GBP via the Business Profile API
- Idempotent: re-running with the same payload is a no-op
- **Phase 1 assumes Northpoint is source of truth.** No GBP-side conflict detection (someone editing GBP directly mid-flow is a Phase 2 concern).
- **Acceptance:** Change hours in profile UI, click save, see updated hours on the real GBP listing within 60s

### F3. "Update my hours" atomic chat interaction
- Single-purpose chat at `/app/chat/hours` (full business chat lands in Phase 2)
- User says "change Saturday hours to 10–4" → chat parses → confirmation card with old vs new → on confirm, updates editor JSON in the published `site_version` AND pushes to GBP in one transaction
- Either both succeed or both roll back
- **Acceptance:** Change Saturday hours via chat, see them update on bcglassandtint.com (or the subdomain) AND on the GBP listing

### F4. Confirmation UI
- After the atomic update, show: "✅ Updated hours on Website (live now) · ✅ Updated on Google Business Profile · ⚪ Yelp not connected — want to add it?"
- This is the moment the differentiator becomes visible
- **Acceptance:** The confirmation card renders correctly after F3 succeeds

---

## Group G — Polish, Testing, BC Glass & Tint launch (Days 29–35)

Depends on Groups E + F.

### G1. Loading + error states
- Every async operation has a loading state
- Every operation has a clear error UI with retry where applicable
- Toast notifications for save/publish success and errors
- **Acceptance:** Disconnect network, try to save, see clear error

### G2. Empty states
- New site with no content: show a helpful "let's get started" screen
- Empty section library category: friendly message
- No drafts yet: prompt to save first draft
- **Acceptance:** Fresh BC Glass & Tint state, all empty states render correctly

### G3. Tablet + desktop polish (mobile acceptable, not gated)
- Editor must work on tablet at minimum, desktop is the primary surface
- Side panels collapse to drawers on small screens
- Toolbars scroll horizontally if needed
- **Acceptance:** Use the editor from an iPad, complete a basic edit

### G4. Credit-burning integration
- Every AI call deducts from a `credits` table per user (instrumented even at single-tenant; pricing TBD)
- Header shows remaining credits
- Out-of-credits modal blocks AI features with "upgrade" CTA (CTA not functional in Phase 1, just shown)
- **Acceptance:** Burn credits with chat usage, see counter decrement; force credits to 0, see modal

### G5. Playwright QA suite (single-tenant scope)
- `/playwright/tests/` covers the single-tenant Phase 1 flows:
  - Manually-provisioned login → editor flow (no signup form to test)
  - Click-to-edit on every element type
  - Save, preview, publish round-trip on Puck JSON
  - Chat edit flow with diff approval
  - Section library add
  - Draft save and load
  - **Atomic hours-update demo (Group F) end-to-end**
- All tests run on every PR
- The `/qa` workflow runs on every staging push
- **Acceptance:** All tests pass, QA workflow posts pass report on a PR

### G6. Data collection pipes
- Every chat message, every edit, every screenshot logged to a separate `events` table or Supabase project
- Toggle in account settings: "Help improve the product by sharing usage data" (default ON for early users, with clear disclosure)
- **Acceptance:** Perform 10 edits, see 10 rows in the events table

### G7. Documentation
- Update `ARCHITECTURE.md` with the actual system as built (including editor abstraction module + Puck integration choices from E1)
- Write a `RUNBOOK.md` for common operational tasks (rotating keys, restarting services, GBP token refresh, etc.)
- Update `CLAUDE.md` if any conventions changed
- **Acceptance:** A new contributor could read the docs and onboard themselves

### G8. BC Glass & Tint goes live on Northpoint
- BC Glass & Tint's current site is fully imported and editable in the Phase 1 editor
- Site published to `bcglassandtint.com` (or `bcglassandtint.northpoint-app.com` if custom domain isn't ready in time)
- Atomic hours-update demo (Group F) recorded as a screen capture, suitable for sharing
- Founder + 1–2 BC Glass & Tint stakeholders walk through onboarding + one real edit + the atomic-hours flow successfully
- **Acceptance:** All four bullets above check out. Phase 1 is shippable.
- *Broader beta testing (3–5 invite-code users) returns at the start of Phase 2.*

---

## Phase 1 ship criteria

Phase 1 is shippable when ALL of these are true:

- [ ] You (admin) and a manually-provisioned BC Glass & Tint account can both log in
- [ ] BC Glass & Tint completes business onboarding and lands in editor with their imported site
- [ ] You can import a real existing site by URL, see it loaded as-is
- [ ] You can edit text, images, and sections via clicking (via the editor abstraction module)
- [ ] You can add new sections from the library or via AI custom
- [ ] You can chat with the AI and apply structural changes (operating on editor JSON)
- [ ] You can save named drafts, load them
- [ ] You can preview without saving
- [ ] You can publish to subdomain or custom domain
- [ ] You can export HTML at any time
- [ ] Tablet + desktop preview works (mobile acceptable, not gated)
- [ ] Basic and Advanced modes both function
- [ ] Credits burn correctly on AI use; manual editing is free
- [ ] Admin panel shows the user list (small), site list, and credit usage
- [ ] One-click switch between admin and client accounts works
- [ ] Playwright QA passes on staging
- [ ] **BC Glass & Tint is live on the Northpoint editor at bcglassandtint.com (or subdomain)**
- [ ] **"Change my hours → website + GBP atomically" demo works end-to-end and is recorded**

When all eighteen are checked, Phase 1 is done and we move to Phase 2 (website generation + full business chat across all platforms + Personal onboarding + multi-tenant signup + FastAPI for cross-platform agents).

---

## What's NOT in Phase 1

Resist scope creep. These come later:

- Website generation from prompt (Phase 2)
- Full business chat across all platforms (Phase 2) — *Phase 1 ships only the single-purpose "update my hours" interaction in Group F*
- GBP write for anything besides hours (Phase 2)
- GBP-side conflict detection (Phase 2) — Phase 1 assumes Northpoint is source of truth
- Personal onboarding flow (Phase 2 — schema-additive, no migration needed)
- Multi-tenant invite-code signup (Phase 2 — Phase 1 is single-tenant alpha)
- FastAPI service / Railway deploy (Phase 2 — Vercel AI SDK v6 covers Phase 1)
- Chat-aware draft referencing (Phase 2 polish — see deferred E13)
- Analytics dashboard for users (Phase 3)
- Domain reselling (Phase 3)
- Instagram/Facebook/Yelp integrations (Phase 3)
- Team accounts, white-label, API (Phase 4)
- Image gen as a standalone studio (killed)
- Competitor analysis (deferred)
- Mobile app (deferred)
- Final product name (parked)

---

## When in doubt

Read `PLAN.md` for product decisions, `CLAUDE.md` for how to work in the repo, this file for what to build next. Ask the founder when something isn't covered.
