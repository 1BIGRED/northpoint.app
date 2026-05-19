# PHASE_1.md — Editor Only

> **Goal:** Ship a website editor that's actually good. Nothing else.
> **Estimated duration:** 4–6 weeks of focused work
> **Done when:** A real user (you, your friend, an alpha tester) can sign up, onboard, import or start a site, edit it via click + chat, save drafts, and publish. Every step works on mobile + desktop. Playwright QA passes on every push.

This is the dependency-ordered build list. Do these in order. Don't skip ahead even if something later seems easier.

---

## Group A — Foundation (Days 1–3)

These have no dependencies. Do them first, in any order.

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
- `/apps/ai/main.py` with a single `/health` endpoint returning `{ok: true}`
- Dockerfile for Railway deploy
- **Acceptance:** `curl localhost:8000/health` returns ok

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
- Connect repo to Railway
- Production env vars set
- **Acceptance:** Push to main deploys the AI service, `/health` is reachable on the prod URL

---

## Group B — Auth + Accounts (Days 4–6)

Depends on Group A.

### B1. Database schema v1 (Drizzle)
Tables:
- `users` (id, email, role enum [admin|user], created_at, updated_at, deleted_at)
- `accounts` (id, user_id, type enum [admin|client], created_at) — for the two-account setup
- `invite_codes` (code, created_by, used_by, used_at, expires_at)
- **Acceptance:** Migrations run clean, schema visible in Supabase dashboard

### B2. Sign up flow with invite code gating
- `/signup` page: email, password, invite code field (required)
- API route validates invite code is unused and unexpired
- On success: create user (role = user), mark invite code used, send verification email
- **Acceptance:** Sign up with valid code works; with invalid code shows error

### B3. Login flow
- `/login` page: email + password, Google OAuth button
- On success: redirect based on role — `admin` → `/admin`, `user` → `/app`
- **Acceptance:** Both email and Google login work, redirects are correct

### B4. Auth middleware
- Next.js middleware that protects `/admin/*` (admin role only) and `/app/*` (authenticated user)
- Unauthenticated visits → redirect to `/login` with return URL
- Wrong-role visits → 403 page with link to correct destination
- **Acceptance:** Direct URL access to `/admin` as a user redirects appropriately

### B5. Generate your two accounts
- Manually create your admin account in Supabase (set role = admin)
- Manually create your client account with a separate email
- Both confirmed via email verification
- **Acceptance:** You can log in as either, see different landing pages

### B6. Add "Switch to client account" button in admin nav
- Top-right button in `/admin` layout
- Opens `/app` in a new tab using the client account's session (or a magic-link-style mechanism — keep it simple)
- **Acceptance:** One click opens your client account in a new tab

### B7. Generate first batch of invite codes
- Simple admin tool at `/admin/invites`: list, generate new, mark expired
- **Acceptance:** Generate 10 codes, see them in the list

---

## Group C — Profile + Onboarding (Days 7–10)

Depends on Group B.

### C1. Database schema v2
Tables:
- `profiles` (id, account_id, type enum [business|personal], structured columns: name, industry, city, state, zip, phone, email, website_url; JSON column for flexible data: services, hours, social_links, brand_colors, tone, etc.; timestamps)
- **Acceptance:** Migrations clean, profiles can be inserted via SQL

### C2. Onboarding scaffolding
- `/onboarding` route, gated: only first-time users with no profile land here
- Step component pattern: each step is a separate component, state managed in a wizard wrapper
- Progress bar at top
- Skip button on every step except Account Type and Basics
- **Acceptance:** Visit `/onboarding` after signup, see step 1

### C3. Step 1 — Account type
- Big two-button choice: Business or Personal
- On select, save to draft profile and advance
- **Acceptance:** Selecting Business goes to business step 2, Personal goes to personal step 2

### C4. Business flow steps 2–7
- Basics, Contact, What You Do, Brand, Integrations (skip-only at launch), Done
- Each step saves to draft profile on Next
- Forms use react-hook-form + zod for validation
- ✨ button next to free-text fields that calls the AI service to generate a suggestion based on prior steps' data
- **Acceptance:** Complete the full business flow, profile row exists in DB with all data, lands at /app

### C5. Personal flow steps 2–6
- Occasion, Name + Date, Audience, Privacy, Tone, Done
- Same form pattern as business
- **Acceptance:** Complete personal flow, profile row exists with type=personal, lands at /app

### C6. Profile page at `/app/profile`
- Same data, same form, ungated. Read + edit.
- Save button updates the profile
- **Acceptance:** Edit a field, save, refresh, see the new value

### C7. AI assist endpoint
- POST `/apps/ai/api/assist-onboarding-field`
- Input: field name, prior profile data
- Output: 1–3 suggestions
- Wraps an Anthropic Sonnet 4.6 call with a prompt from `/apps/ai/prompts/onboarding-assist-v1.md`
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
- POST `/apps/ai/api/import-site`
- Input: URL
- Output: extracted HTML, CSS, image URLs, structure metadata
- Implementation: server-side fetch + cheerio/jsdom to clean up, inline critical CSS, rewrite asset URLs to absolute
- **Do not improve.** Store imported content verbatim.
- **Acceptance:** Paste a real small business website URL, see imported HTML stored in `site_versions`

### D4. Subdomain provisioning
- For now: hardcoded wildcard `*.northpoint-app.com` (placeholder domain) pointing to Vercel
- When a site is created, assign a slug from profile name (slugified, collision-suffixed)
- Subdomain `[slug].northpoint-app.com` serves the published version of that site
- **Acceptance:** A test profile's site is reachable at its subdomain

### D5. Custom domain connection (basic)
- Settings page: enter custom domain, get CNAME instructions
- DNS check API that polls until the domain points correctly
- Once verified, the published site serves on the custom domain too
- **Acceptance:** Connect a real test domain, verify it serves the site

---

## Group E — The Editor (Days 14–28, the bulk of Phase 1)

Depends on Group D.

### E1. Editor shell layout
- `/app/sites/[id]/edit` route
- Three-pane layout: left (pages + drafts panel), center (live preview), right (AI chat panel)
- Top bar: Save, Preview, Publish, Basic↔Advanced toggle, viewport toggle (mobile/tablet/desktop), back button
- Collapsible panels for screen real estate
- **Acceptance:** Visit the route, see all three panels with placeholder content

### E2. Live preview iframe
- Center pane renders an iframe pointing to a render endpoint that returns the current draft's HTML
- Iframe updates live as the draft changes (postMessage protocol)
- Viewport toggle changes iframe width: 375 / 768 / 1280
- **Acceptance:** Edit the draft HTML via DB, see iframe update; toggle viewport, see iframe resize

### E3. Click-to-edit foundation (text)
- Inside the iframe, every text node becomes hover-highlightable
- Click a text node → floating toolbar appears with: font size, color (palette from brand colors), bold, italic, alignment, link
- Edits write to the draft via postMessage → editor parent → API
- **Acceptance:** Click an h1, change its text and color, see it update in the iframe and persist to DB

### E4. Click-to-edit for images
- Click an image → floating toolbar: replace from URL, upload (Supabase Storage), AI generate (burns credits), alt text, delete
- **Acceptance:** Replace an image via upload, see new image in iframe

### E5. Click-to-edit for sections
- Sections defined by HTML element with `data-section` attribute
- Click a section → drag handles for reorder, plus buttons: duplicate, delete, "AI improve this section"
- "+ Add Section" buttons appear between sections
- **Acceptance:** Reorder two sections via drag, see new order persist

### E6. Section library
- "+ Add Section" opens a side panel with categories: Hero, About, Services, Gallery, Testimonials, FAQ, CTA, Contact, Footer
- Each category has 3–5 visual variants stored as HTML templates
- Click a variant → inserts into the site at the position the + was clicked
- AI section button at top of panel: text input → AI generates a custom section in the site's existing style
- **Acceptance:** Add a "Services" section from the library, see it appear; use AI custom: "add a section about our financing options"

### E7. Save / Preview / Publish
- **Save button:** opens a "Name this draft" modal, saves a new `site_versions` row with the name
- **Preview button:** opens current state in a new tab on a `/preview/[siteId]?version=draft` URL
- **Publish button:** marks current draft as the published version, propagates to subdomain + custom domain; if user's hosting is external, generates an HTML export download
- **Acceptance:** Save a named draft, see it in drafts panel; preview opens new tab; publish makes the site live

### E8. Drafts panel
- Left sidebar: list of saved drafts with name, timestamp, thumbnail (screenshot via Playwright at save time)
- Click a draft → load it into the editor (with confirmation if current has unsaved changes)
- Delete option per draft
- **Acceptance:** Save 3 drafts, switch between them, delete one

### E9. AI chat in editor
- Right panel: standard chat UI
- Streaming responses via the FastAPI service
- The AI has tools available:
  - `read_site_html()` — get current draft HTML
  - `read_profile()` — get business profile
  - `read_draft(name)` — get a named draft's HTML
  - `apply_edit(diff)` — apply a structured edit to the current draft
  - `restructure(instruction)` — read site, plan, apply structural changes (Opus 4.7)
  - `generate_section(description)` — generate a new section in current style
- Every AI response that includes an edit shows a diff preview before applying
- Undo button always available
- **Acceptance:** Chat: "change all phone numbers to 702-555-1234" → preview diff → accept → all numbers change

### E10. Basic vs Advanced toggle
- Default: Basic mode. Floating toolbars show simplified options.
- Advanced mode: unlocks raw CSS editor, custom HTML insertion, full layout/spacing controls, code view tab
- Toggle persists per user (in account settings)
- **Acceptance:** Toggle to Advanced, see new options appear; toggle back, see them hide

### E11. Mobile/tablet/desktop preview
- Top-bar buttons set iframe width
- AI chat is aware of current viewport when generating sections (responsive by default)
- **Acceptance:** Switch to mobile preview, AI-generated sections respect mobile layout

### E12. Chat-aware draft referencing
- In chat: "use the hero from draft 'bold v2' and the services from draft 'minimal v4'"
- AI uses `read_draft()` tool, extracts requested sections, merges into current
- **Acceptance:** Save two named drafts, reference them in chat, see merge happen

---

## Group F — Polish + Testing (Days 29–35)

Depends on Group E.

### F1. Loading + error states
- Every async operation has a loading state
- Every operation has a clear error UI with retry where applicable
- Toast notifications for save/publish success and errors
- **Acceptance:** Disconnect network, try to save, see clear error

### F2. Empty states
- New site with no content: show a helpful "let's get started" screen
- Empty section library category: friendly message
- No drafts yet: prompt to save first draft
- **Acceptance:** New account, all empty states render correctly

### F3. Mobile-friendly editor (responsive)
- Editor itself must work on tablet at minimum, mobile acceptably
- Side panels collapse to drawers on small screens
- Toolbars scroll horizontally if needed
- **Acceptance:** Use the editor from an iPad, complete a basic edit

### F4. Credit-burning integration
- Every AI call deducts from a `credits` table per user
- Header shows remaining credits
- Out-of-credits modal blocks AI features with "upgrade" CTA (CTA not functional in Phase 1, just shown)
- **Acceptance:** Burn credits with chat usage, see counter decrement; force credits to 0, see modal

### F5. Playwright QA suite
- `/playwright/tests/` covers:
  - Signup → onboarding → editor flow
  - Click-to-edit on every element type
  - Save, preview, publish round-trip
  - Chat edit flow with diff approval
  - Section library add
  - Draft save and load
- All tests run on every PR
- The `/qa` workflow runs on every staging push
- **Acceptance:** All tests pass, QA workflow posts pass report on a PR

### F6. Data collection pipes
- Every chat message, every edit, every screenshot logged to a separate `events` table or Supabase project
- Toggle in account settings: "Help improve the product by sharing usage data" (default ON for early users, with clear disclosure)
- **Acceptance:** Perform 10 edits, see 10 rows in the events table

### F7. Documentation
- Update `ARCHITECTURE.md` with the actual system as built
- Write a `RUNBOOK.md` for common operational tasks (rotating keys, restarting services, etc.)
- Update `CLAUDE.md` if any conventions changed
- **Acceptance:** A new contributor could read the docs and onboard themselves

### F8. Beta tester checklist
- Pick 3–5 people (including you in client mode, ideally one existing client, one personal-site user, one technical friend)
- Send invite codes
- Give them a structured task: complete onboarding, edit your imported site, save 2 drafts, publish
- Collect feedback via a shared doc
- **Acceptance:** All beta testers complete the task and provide written feedback

---

## Phase 1 ship criteria

Phase 1 is shippable when ALL of these are true:

- [ ] You can sign up via invite code, complete business onboarding, land in editor with a default site
- [ ] You can import a real existing site by URL, see it loaded as-is
- [ ] You can edit text, images, and sections via clicking
- [ ] You can add new sections from the library or via AI custom
- [ ] You can chat with the AI and apply structural changes
- [ ] You can save named drafts, load them, reference them in chat
- [ ] You can preview without saving
- [ ] You can publish to subdomain or custom domain
- [ ] You can export HTML at any time
- [ ] Mobile/tablet/desktop preview works
- [ ] Basic and Advanced modes both function
- [ ] Credits burn correctly on AI use; manual editing is free
- [ ] Admin panel shows you the user list, site list, and credit usage
- [ ] One-click switch between admin and client accounts works
- [ ] Playwright QA passes on staging
- [ ] You and 3+ beta testers have completed a full flow successfully

When all sixteen are checked, Phase 1 is done and we move to Phase 2 (website generation + business chat + GBP).

---

## What's NOT in Phase 1

Resist scope creep. These come later:

- Website generation from prompt (Phase 2)
- Business chat that takes actions (Phase 2)
- Google Business Profile integration (Phase 2)
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
