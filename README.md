# northpoint (placeholder name)

A public SaaS website editor with an AI brain — built for small business owners and individuals who want a real web presence without writing code. The differentiator: an AI that understands the user's site and business, not a chatbot bolted onto a template builder.

> **Internal placeholder name.** `northpoint` is not the final product name. User-facing strings should use `{{PRODUCT_NAME}}` so we can search-replace later.

## Tech stack

- **Monorepo:** pnpm + Turborepo
- **Frontend:** Next.js (app router) + TypeScript + Tailwind + shadcn/ui
- **Backend (CRUD/auth):** Next.js API routes
- **Backend (AI/agents):** FastAPI in `/apps/ai` (Python 3.12+)
- **Database / auth / storage:** Supabase (Postgres, Drizzle ORM, pgvector when needed)
- **LLM:** Anthropic API (Sonnet 4.6 default, Opus 4.7 for structural edits), OpenAI as fallback
- **Hosting:** Vercel (web) + Railway (AI service)
- **Payments:** Stripe
- **QA:** Playwright MCP in dev, standard Playwright in GitHub Actions

## Planning docs (read these before working in this repo)

1. [`CLAUDE.md`](./CLAUDE.md) — session rules for Claude Code: conventions, do's and don'ts, where things go
2. [`docs/PLAN.md`](./docs/PLAN.md) — product vision, locked decisions, architecture, pricing model
3. [`docs/PHASE_1.md`](./docs/PHASE_1.md) — current phase build order (editor only), dependency-ordered

## Repo layout

```
/apps
  /web              Next.js frontend + API routes
  /ai               FastAPI service for AI / agent work (Python)
/packages
  /ui               Shared UI components (shadcn/ui lives here in A2+)
  /db               Drizzle schema, migrations, DB access (Group B+)
  /types            Shared TypeScript types
/docs               PLAN.md, PHASE_1.md, ARCHITECTURE.md (later)
```

## Prerequisites

- **Node 22+** (`.nvmrc` pins to 22; `nvm use` will pick it up)
- **pnpm 10+** — install with `corepack enable && corepack prepare pnpm@latest --activate`
- **Python 3.12+** (for `/apps/ai`)

## Setup

```bash
pnpm install              # installs JS deps for all workspaces
cp .env.example .env.local # then fill in real values (see Environment variables below)
```

## Environment variables

All required env vars are documented in [`.env.example`](./.env.example). Copy it to `.env.local` and fill in real values. `.env.local` is gitignored — never commit credentials.

The Supabase values come from your project's dashboard → Project Settings → API (URL + keys) and → Database (connection string). The `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never appear in client code.

Some Supabase configuration (auth providers, email templates) must be set in the dashboard rather than in code — see [`docs/SUPABASE_DASHBOARD_SETUP.md`](./docs/SUPABASE_DASHBOARD_SETUP.md).

The Python venv for `/apps/ai` is created automatically on first `pnpm dev` via `apps/ai/dev.sh`. To set it up manually:

```bash
cd apps/ai
python3 -m venv .venv
.venv/bin/pip install -e .
```

## Common commands

| Command | Effect |
|---|---|
| `pnpm dev` | Starts `apps/web` on :3000 and `apps/ai` on :8000 in parallel via Turborepo |
| `pnpm build` | Builds every workspace |
| `pnpm lint` | Lints every workspace |
| `pnpm typecheck` | Typechecks every workspace |
| `pnpm --filter @northpoint/web dev` | Runs a single workspace |

## Status

Pre-launch. Brand-new repo, separate from any prior project. Phase 1 (editor only) is the current focus — see `docs/PHASE_1.md` for the build order. Currently on **A3: Supabase setup**.
