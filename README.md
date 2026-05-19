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

## Status

Pre-launch. Brand-new repo, separate from any prior project. Phase 1 (editor only) is the current focus — see `docs/PHASE_1.md` for the build order.
