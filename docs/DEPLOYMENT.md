# Deployment

How `northpoint` is hosted in Phase 1. Initial setup landed in A7 (see `docs/PHASE_1.md`).

---

## What's deployed

| Service | Where | URL |
|---|---|---|
| `apps/web` (Next.js 16, app router) | Vercel | **https://northpoint-app-web.vercel.app** (production) |
| `apps/ai` | Not deployed in Phase 1 — see `apps/ai/README.md` | — |

### URL patterns

- **Production:** `https://northpoint-app-web.vercel.app` — Vercel auto-generated the subdomain from `<project-name>-<root-directory-basename>`. The `-web` suffix is the `apps/web` Root Directory leaking into the URL; it disappears later when we attach a real custom domain.
- **Per-deployment immutable URL:** `https://northpoint-app-web-<git-sha>-<vercel-account-slug>.vercel.app` (visible in the Vercel dashboard for every deployment; useful for sharing a specific build with a reviewer).
- **Per-branch alias:** `https://northpoint-app-web-git-<branch-slug>-<vercel-account-slug>.vercel.app` (auto-generated for every branch with a deployment).
- **PR preview:** posted as a deployment status check on each PR; format is the per-deployment immutable URL.

---

## Deploying

### Production
- **Push to `main` → Vercel auto-deploys to production.**
- `main` is protected by the GitHub Actions `PR Checks` workflow, so every merge to `main` has already passed typecheck / lint / build.

### Preview
- **Open a PR → Vercel auto-deploys a preview URL.**
- The preview URL is posted as a deployment status check on the PR.
- Every subsequent push to the PR creates a new immutable preview deploy at a fresh URL.

### Manual / emergency
- Vercel CLI from any branch: `pnpm dlx vercel --prod` (after `vercel login`).
- Not the normal path — use only for emergency hotfix when GitHub Actions is down.

---

## Rolling back

Vercel deployments are immutable, so rollback is instant and free.

1. Vercel dashboard → northpoint project → **Deployments**.
2. Find the last known-good deployment (use timestamp / commit SHA).
3. Click **⋯ → Promote to Production**.
4. Production traffic switches instantly.
5. (Optional) revert the offending commit on `main` so the next deploy doesn't re-introduce the bug.

---

## Checking logs

- **Build logs:** Vercel dashboard → Deployments → click a deployment → **Build Logs**.
- **Runtime logs (functions):** Vercel dashboard → Deployments → click a deployment → **Functions** → **Logs** (live tail).
- **CLI:** `pnpm dlx vercel logs <deployment-url>` (after `vercel login`).

---

## Environment variables

Set these in Vercel dashboard → northpoint project → **Settings → Environment Variables**. Scope each to Production + Preview + Development.

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API Keys (the `sb_publishable_…` value, pasted into this Phase-1-named slot) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API Keys (the `sb_secret_…` value, pasted into this Phase-1-named slot) |

The same set is documented in `.env.example` at the repo root. Real values live ONLY in:
- `apps/web/.env.local` (gitignored, local dev)
- Vercel dashboard env vars (production + preview)

Never commit a real key. Never paste a real key into a PR description, issue, commit message, or chat log.

---

## Project configuration (reproducible)

Captured in `apps/web/vercel.json`:

| Setting | Value | Why |
|---|---|---|
| `framework` | `nextjs` | Vercel uses this for default build/runtime behavior |
| `installCommand` | `cd ../.. && pnpm install --frozen-lockfile` | `pnpm-lock.yaml` lives at the repo root, not in `apps/web` |
| `buildCommand` | `cd ../.. && pnpm turbo run build --filter=@northpoint/web` | Runs from the repo root so Turborepo resolves workspace deps; filter limits build to the web app + its prerequisites |

Set in the Vercel dashboard (must match):
- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js (auto-detected once Root Directory is set)
- **Node.js version:** 22.x (default; matches CI)
- **Output Directory:** `.next` (default for Next.js)

---

## First-time Vercel project setup (one-off)

Steps to import the repo and reach a green production deploy:

1. **Import the repo.** Vercel dashboard → **Add New → Project** → select `1BIGRED/northpoint.app`.
2. **Configure project settings** (Vercel asks before the first build):
   - Framework Preset: **Next.js** (auto-detected after step 3)
   - **Root Directory: `apps/web`** ← click **Edit** to set this
   - Build Command / Install Command / Output Directory: leave as defaults; `apps/web/vercel.json` overrides them with the correct monorepo commands
3. **Set environment variables** (three rows, all scopes = Production + Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Deploy.** Vercel runs the first build from `main`.
5. **Verify production:** load the production URL, hit `/debug/supabase`, expect the green "Supabase connected ✓" block.
6. **Update this file.** Replace _filled in after first deploy_ with the actual production URL.

---

## Known quirks

- **Page `<title>` now reads "Northpoint."** (Previously the literal placeholder `{{PRODUCT_NAME}}` per `CLAUDE.md` §1; the placeholder has since been replaced with the product name.)
- **`favicon.ico` 404** on every page — no favicon committed yet. Cosmetic; resolves when branding lands.
- **Vercel auto-suffix in URL** (`-web` from Root Directory `apps/web`) — see URL patterns above. Disappears with a custom domain.
- **First-build env-var warning from Turborepo:** the Vercel build log showed Turbo didn't know about the Supabase env vars and Next.js had to read them via its own env loading. Functionally correct (Supabase is connected and `/debug/supabase` is green), but messy enough that it's getting fixed in a follow-up PR by declaring the three vars under `tasks.build.env` in `turbo.json`.
- **pnpm "Ignored build scripts" warning** on every install — `unrs-resolver` (and likely `sharp` once it triggers) need explicit approval via `pnpm.onlyBuiltDependencies` in the root `package.json`. Fixed in the same follow-up PR as the Turbo env var fix.

---

## Related docs

- `apps/ai/README.md` — why `apps/ai` is empty in Phase 1
- `docs/PHASE_1.md` — A7 acceptance criteria and the broader build order
- `CLAUDE.md` §3 — tech stack table (Vercel is the only Phase 1 host)
