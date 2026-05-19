# Master Plan — `northpoint` (placeholder name)

> **Status:** Pre-launch, brand-new repo, separate from existing Jarvis project.
> **Final name:** TBD. We rebuild and rename later when one clicks. All references to "northpoint" in code, configs, and docs are placeholders.
> **Working tagline:** *Your place on the internet, kept.*

---

## 1. What this is

A public SaaS product where small business owners and individuals create, edit, and manage their entire web presence from one place. The differentiator: an AI that genuinely understands their site and their business, not a chatbot bolted onto a template builder.

**One sentence:** A website editor with an AI brain, sold as SaaS, that grows into a full web-presence manager.

**Primary customer at launch:** small business owners with simple web needs — service businesses (tinting, salons, contractors, restaurants), local retail, professionals.

**Secondary marketing angle:** personal sites (weddings, families, events, portfolios, hobby projects). Same product, different onboarding flow.

The product is built for people who are *not* technical. They should never see code unless they flip the Advanced toggle.

---

## 2. Decisions locked

| Area | Decision |
|---|---|
| Project name | Placeholder `northpoint`, rename later |
| Launch model | Public SaaS, invite-only at start, opens up after stability period |
| Account types | Business (primary), Personal (secondary), forked at step 1 of onboarding |
| Multi-business | One included, additional sites cost extra |
| Free trial | 1 month, no credit card required |
| End of trial | Site goes offline, profile becomes read-only, data preserved 90 days, HTML export remains free forever |
| Paid tiers | Basic / Pro / Max with monthly non-rolling credits |
| Credit usage | AI features burn credits, manual editing is free |
| Overage | Auto-bill at higher per-credit rate OR manual bulk credit pack (cheaper). Packs deduct from pending overage first. Hard cap setting prevents runaway charges. |
| Domains | Free subdomain at launch, custom domain connect at launch, domain reselling deferred to Phase 3 |
| Editor experience | Wix-style click-to-edit + Durable-style AI chat + Basic/Advanced toggle |
| AI-fills during onboarding | Opt-in only, per-field ✨ button — no auto-magic |
| Imports | As-is, AI improves only when explicitly asked |
| Admin/owner panel | What was "dev mode" — accounts, billing, analytics, sites, system health |
| Your account setup | Two separate accounts (admin + client), one auth system, one-click switch |
| Dev tooling | Playwright MCP for Claude Code, GitHub Actions QA on every staging push |
| Project status | Brand new repo, brand new everything. Existing Jarvis untouched. |

---

## 3. What gets killed

- Image Studio as a standalone tool — when an image is needed in the editor, it's a one-line call to a model. No dedicated UI.
- Standalone Audit Agent — absorbed into website-gen flow
- Competitor Analysis as a separate product — deferred to Phase 4+
- Training pipeline as a feature — we collect data into pipes, decide later what to do with it
- The Jarvis butler personality for the SaaS — stays as your personal local project on the Ryzen rig, unrelated to this product

---

## 4. Architecture (top-down)

### Public marketing site (`/`)
What it is, who it's for, what makes it different, pricing teaser, "Request invite" form.

### Auth (`/login`, `/signup`)
Email/password + Google OAuth. Invite code required at signup during invite-only phase. Each email = one account. Account has a `role` field: `admin` (you) or `user` (everyone else).

Your **admin** account lands at `/admin`. Your separate **client** account lands at `/app` like every other user. Two emails, two logins, one auth system, one-click switch button in admin nav opens client account in new tab.

### Admin panel (`/admin`)
- Users (list, search, impersonate, suspend, role management)
- Sites (all sites across all users, traffic, status, take action)
- Billing (Stripe dashboard integration or summary)
- Analytics (signups, MAU, churn, feature usage, credit usage)
- System health (uptime, error rate, AI API costs, queue depth)
- Training data pipes (collect everything, decide later)
- Feature flags (per-user toggles)
- Invite codes (generate, send, track)

### Client app (`/app`)
The product everyone uses, including you in client mode.

- **Dashboard** — list of sites, recent activity, credit usage, alerts
- **Onboarding** (`/onboarding`) — gated first-run flow, builds the profile before they touch anything else
- **Site editor** (`/app/sites/[id]/edit`) — the heart of Phase 1
- **Business chat** (`/app/chat`) — Phase 2, knows the profile, takes actions
- **My Profile** (`/app/profile`) — same data captured in onboarding, editable forever
- **Account settings** (`/app/settings`) — password, billing, team, credit usage, integrations
- **Analytics** (`/app/sites/[id]/analytics`) — Phase 3+

---

## 5. Onboarding spec

**Step 0 — Welcome.** "Let's set up your profile. Takes about 3 minutes. This is the brain that powers everything."

**Step 1 — Account type.** Business or Personal. Forks the flow.

### Business flow (7 steps after the fork)
- **Basics:** business name, owner/contact name, industry dropdown with search, city/state/ZIP
- **Contact:** phone, email, address with "no storefront" toggle, service area (radius or city list), hours per day with closed/by-appointment options
- **What you do:** one-sentence description, services list (free-form), years in business, what makes you different
- **Brand:** logo upload (optional), brand colors, tone of voice (Professional/Friendly/Bold/Casual), existing website URL for import
- **Integrations:** Google Business Profile (connect or skip), social accounts (skip is fine)
- **Done:** "Generate a draft website now" or "Jump into the editor" — both land in editor

### Personal flow (5 steps after the fork)
- **Occasion:** Wedding / Baby / Event / Memorial / Portfolio / Hobby / Other
- **Your name + event date** (if applicable)
- **Audience:** just me / me + partner / family / friends / the public
- **Privacy:** public / unlisted (link only) / password-protected
- **Tone:** Elegant / Fun / Casual / Formal + optional photo uploads
- **Done.**

### Design principles for onboarding
- Every step skippable except Account Type and Basics. Friction = drop-off.
- AI fills blank fields only when user clicks the ✨ button on that field. No auto-magic.
- Profile editable forever from `/app/profile`. Same fields, no gating.
- Profile is source of truth for: website gen, editor chat, business chat, GBP sync.
- Subtle copy at each step shows where data ends up: "This is what we'll show on your Contact page."

### Storage shape
One `profiles` row per profile (multiple per account if user has multiple sites).
- Structured columns for fields we query often: name, type (business|personal), industry, city, phone, email
- JSON column for flexible fields: services, hours, social links, brand colors, custom data

---

## 6. Editor spec (Phase 1's main work)

### Layout
- Center: live preview of their site, fully responsive
- Right side panel: AI chat (collapsible)
- Left side panel: pages list + drafts list
- Top bar: Save / Preview / Publish + Basic↔Advanced toggle + Mobile↔Tablet↔Desktop toggle + back to dashboard
- Floating context toolbars appear when an element is clicked

### Click-to-edit interactions
- **Click text** → floating toolbar with font, size, color, bold/italic, alignment, link
- **Click image** → swap, replace from URL, upload, alt text, delete, AI generate (burns credits)
- **Click section** → drag handles for reorder, duplicate, delete, "AI improve this section" button
- **"+ Add Section" button** between any two sections → side panel with section library (hero, about, services, gallery, testimonials, FAQ, CTA, contact, footer) + "Describe what you want" AI option at top

### AI chat in editor
- Knows the entire site HTML at all times
- Can do anything click-to-edit can do, plus:
  - **Structural restructure**: "reorder service cards to prioritize tint removal" — reads cards, understands them semantically, reorders
  - **Cross-page changes**: "change phone number everywhere on the site"
  - **Content generation**: "write an FAQ section based on common customer questions"
  - **Reference drafts**: "use the hero from draft 'bold v2', services section from draft 'minimal v4'"
- Every AI edit shows a diff/preview before applying, with one-click undo always available
- Chat history persists per site

### Basic vs Advanced toggle (top right)
- **Basic** (default): only safe stuff — text edits, color picks from brand palette, swap images, reorder/add/delete pre-built sections. Can't break the site.
- **Advanced**: unlocks raw CSS tweaks, custom HTML blocks, code view, granular layout/spacing controls. For when you're in a client's account fixing something.

### Save / Preview / Publish
- **Save** — creates a named, timestamped draft. User can name it.
- **Preview** — opens current state in new tab, no save needed
- **Publish** — pushes live to their site (instant if on your hosting; export HTML/CSS/JS if not)
- **Drafts panel** — list with thumbnails, click to load. Versioned and chat-referenceable.

### Mobile/tablet/desktop preview
- Top-bar toggle flips viewport between 375px (mobile), 768px (tablet), 1280px (desktop)
- Editor reads current viewport when AI generates new sections
- Critical for service-business clients who check their site on phones

---

## 7. Business chat (Phase 2, sketched here for completeness)

- Full chat interface, knows the entire profile + connected platforms
- Action-taking, not just answering
- Pattern: user says "change my hours" → chat asks via popup form → on confirm, updates everywhere the profile lives (website HTML, GBP, more later)
- Reports back: "Updated hours on your website and Google Business Profile. Yelp isn't connected — want to add it?"
- This is what makes the product worth paying for. Wix can't do this. Durable can't do this.

---

## 8. Pricing model (final shape)

### Free trial
- 1 month, no credit card
- 1 site, full editor access
- Manual edits unlimited (click, drag, type, swap images)
- Export to HTML unlimited
- Publish to subdomain or custom domain
- Capped AI credits (enough to feel the magic, not enough to live on)
- Day 31 if not upgraded: site goes offline, profile read-only, data preserved 90 days, HTML export still works

### Paid tiers (placeholder names: Basic / Pro / Max)

| | Basic | Pro | Max |
|---|---|---|---|
| Sites | 1 | 3 | 10 |
| AI credits / month (non-rolling) | TBD | TBD | TBD |
| Credit overage rate | $X | $X | $X |
| Features | Editor + AI chat | + Business chat + GBP sync | + Analytics + integrations + team seats |
| Support | Email | Email priority | Priority + dedicated |

### Credits
- AI features burn credits (chat edits, generation, business chat actions, image gen calls)
- Manual editing is free forever
- Monthly allotment does not roll over
- Overage options:
  - **Auto-overage** (opt-in): system keeps generating, charges at higher per-credit rate on next bill
  - **Manual top-up** (any time): credit packs at lower bulk rate
- **Credit packs deduct from pending overage first**, then add to balance
- **Hard cap setting** (default = monthly tier price × 2) prevents runaway. User can raise/lower.

### Critical UX
- "Your work is always yours, never held hostage" — HTML export is free during trial, free after downgrade, free always. Customers don't lose access to their site files when they cancel.

---

## 9. Tech stack

### Frontend
- **Next.js** (app router) + **React** + **TypeScript**
- **Tailwind CSS** for styling
- **shadcn/ui** for component library (free, copy-paste, fully customizable)
- **Zustand** or **Jotai** for client state (lighter than Redux)
- **TanStack Query** for server state and caching

### Backend
- **Next.js API routes** for simple CRUD, auth, billing webhooks
- **FastAPI** (Python) for the AI/agent service — separate process, handles long-running streaming and browser automation
- **Supabase** for auth + Postgres + storage + realtime (Phase 2)
- **pgvector** (free, Supabase ships it) for RAG/embeddings when business chat lands

### Hosting
- **Vercel** for Next.js frontend
- **Railway** or **Fly.io** for FastAPI service
- **Supabase** managed for DB + auth + storage

### AI
- **Anthropic API** (primary): Claude Sonnet 4.6 for most chat, Opus 4.7 for structural edits and reordering
- **OpenAI API** (fallback): for image gen via gpt-image-1, and as a backup LLM if Anthropic is down

### Browser automation
- **Playwright MCP** for Claude Code dev workflow (you, in a Claude Code session)
- Regular **Playwright** for production QA pipeline

### Payments
- **Stripe** for subscriptions, billing, invoices, tax (Stripe Tax handles US sales tax)

### Email
- **Resend** for transactional (signup, password reset, alerts)

### Repo structure
```
/apps
  /web              # Next.js frontend + API routes
  /ai               # FastAPI service for AI/agent work
/packages
  /ui               # shared shadcn/ui components
  /types            # shared TypeScript types
  /db               # Drizzle/Prisma schema, migrations
/infra              # deployment configs, Terraform if needed
/playwright         # QA test suite + Claude Code skills
/docs               # CLAUDE.md, ARCHITECTURE.md, etc.
```

Monorepo with **pnpm** + **Turborepo** (free, fast, well-supported in Claude Code).

---

## 10. Phases

### Phase 1 — Editor only (4–6 weeks)
Ship a website editor that's actually good. Nothing else.

See `PHASE_1.md` for the issue-by-issue build order.

Phase 1 includes minimum viable auth, accounts, onboarding, and admin panel — but only what's needed to use the editor. No business chat. No analytics. No integrations. No website gen.

### Phase 2 — Website generation + business chat (4–6 weeks after Phase 1)
- Generate a site from prompt + profile data → drop into editor → refine
- Business chat that knows the profile and takes actions
- Google Business Profile integration (read + write)
- Full admin panel (analytics, billing UI, system health)

### Phase 3 — Custom domains reselling + integrations (4–6 weeks)
- Domain registrar API (Namecheap/Porkbun/Cloudflare) for in-app domain purchase
- Instagram, Facebook, Yelp integrations
- Per-site analytics dashboard for users

### Phase 4 — Agency/team features + scale
- Team accounts (multiple users per workspace)
- White-label option
- API for agencies
- Competitor Analysis (deferred from original Jarvis)

---

## 11. Project hygiene

### Separation from existing Jarvis
- New GitHub repo (private at first)
- New Anthropic API key (separate billing, separate kill switch)
- New Supabase project (clean DB)
- New deployment targets (no DNS collision)
- Existing BC Glass & Tint + future clients stay on current Netlify setups until product is ready to migrate them
- Personal British-butler Jarvis on the Ryzen rig stays exactly as it is

### Risk mitigation
- This is a separate bet. If it fails, existing Jarvis and current clients are unaffected.
- If it succeeds, existing clients become beta customers and case studies.

### CLAUDE.md
The repo will have a `CLAUDE.md` at root that tells every Claude Code session what to do, how things are organized, and what not to do. See `CLAUDE.md`.

### Naming
The product name is parked. Build everything under `northpoint` as placeholder. When a name lands, rename via search-and-replace + DNS update. Internal name and final name are decoupled.

---

## 12. Things deferred for later

- Product name (parked)
- Final domain
- Logo and full visual identity (start with Inter + black/white + a simple wordmark)
- Pricing dollar amounts (need to know AI cost per user first; ballpark after 100 beta users)
- Marketing site copy
- Specific section library content
- Whether to support custom code components in Advanced mode
- Mobile app
- Public API
- Affiliate program
- AI training data usage strategy

---

## 13. Source of truth

- This doc (`PLAN.md`) — product vision, decisions, architecture
- `CLAUDE.md` — Claude Code session rules
- `PHASE_1.md` — exact build order for current phase
- GitHub issues — atomic work items per phase

All four are kept in sync. When a decision changes, update this doc first, then propagate.
