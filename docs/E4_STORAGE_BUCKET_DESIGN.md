# E4 — Supabase Storage bucket design (site images)

**Status:** design / proposal. No code or buckets created yet.
**Scope:** the Storage bucket(s) backing image upload for the editor's Image block (PHASE_1 E5). Covers bucket layout, access control, the upload path, and how stored objects connect to the editor document.

This is the design we implement when E5's image-swap feature is built. It exists now so the decisions are made deliberately, not improvised at the keyboard.

---

## 1. What needs to be stored

The editor's **Image block** currently takes a `src` URL (`apps/web/lib/editor/components/image.tsx`). E5 adds three ways to set it: paste a URL, **upload a file**, or AI-generate (Phase 2). This doc is about the **upload** case.

A site is made of pages (`site_pages`) belonging to a site (`sites`) belonging to an account (`accounts`) belonging to a user. Uploaded images are **per site**: they are assets of one business's website. They are ultimately served on the **public** render route (`/sites/[siteId]`), so the delivered image must be publicly readable. But *uploading* is a privileged action — only the site owner may add or remove a site's images.

So we have an asymmetry: **public read, owner-only write.** That drives the whole design.

---

## 2. Bucket choice: one public bucket

**Decision: a single public bucket named `site-media`.**

Supabase Storage buckets are either public or private:

- **Public bucket** — objects are readable by anyone with the URL via `…/storage/v1/object/public/site-media/<path>`. No signing, no expiry, cacheable on a CDN. Writes are still gated by RLS on `storage.objects`.
- **Private bucket** — every read needs a signed URL (time-limited) or an authenticated request.

Published site images are public content by definition — they appear on a public marketing page that anyone can load. Signed URLs would mean re-signing on every render and would break CDN caching and static generation of the public route. So **public bucket** is correct here.

We do *not* split public/private buckets in Phase 1. If we later add private assets (e.g. draft-only images that shouldn't be guessable before publish), that's a second bucket (`site-media-private`) with signed URLs — additive, not a redesign.

> **Note on privacy:** a public bucket means an object is readable by anyone who knows (or guesses) its path. We mitigate guessing with a UUID-segmented path (below). This is acceptable because these are website images intended for public display. Never put anything sensitive in `site-media`.

---

## 3. Object path layout

```
site-media/
  <site_id>/
    <uuid>.<ext>
```

Example: `site-media/098bbcab-bbe1-43e8-9bad-ff1ebd67f9a2/3c1f....webp`

Rationale:

- **First segment = `site_id`.** This is the unit of ownership and the key the write policy keys off (below). It also makes "delete all of a site's media" a single prefix operation, and keeps one business's assets from colliding with another's.
- **Filename = a fresh UUID**, not the original filename. Avoids collisions, avoids leaking user filenames, and makes paths unguessable enough for a public bucket. Keep the original extension (or normalize — see §6) so content-type is obvious.
- **No `account_id` in the path.** A site can in principle move accounts; `site_id` is the stable owner key and is what RLS can check via the existing `sites → accounts` join.

We deliberately avoid a per-page (`path`) segment: images are owned by the site, can be reused across pages, and the editor document references them by full URL anyway.

---

## 4. Access control (RLS on `storage.objects`)

Storage objects are rows in `storage.objects`; access is governed by RLS policies on that table, scoped by `bucket_id`. The bucket being "public" only affects **read** — write/delete still need policies.

The owner check reuses the exact ownership chain already used by `sites_owner_all` / `site_pages_owner_all` (migrations 0000–0002): the first path segment is a `site_id`, and the current user must own that site through `sites → accounts.user_id = auth.uid()`.

Proposed policies (to land as a Drizzle custom migration when E5 is built — `storage.objects` is a Supabase-managed table, so these are hand-written SQL, same pattern as our RLS migrations):

```sql
-- Public read of everything in the bucket (the bucket is also marked public,
-- which covers the unauthenticated CDN path; this policy covers the
-- authenticated-client read path for completeness).
create policy "site_media_public_read"
  on storage.objects for select
  to anon, authenticated
  using ( bucket_id = 'site-media' );

-- Owner-only insert: the first path segment must be a site the user owns.
create policy "site_media_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-media'
    and exists (
      select 1 from sites
      join accounts on accounts.id = sites.account_id
      where sites.id = (storage.foldername(name))[1]::uuid
        and accounts.user_id = auth.uid()
        and sites.deleted_at is null
    )
  );

-- Owner-only update + delete: same ownership predicate.
create policy "site_media_owner_modify"
  on storage.objects for update
  to authenticated
  using ( /* same exists(...) as insert */ );

create policy "site_media_owner_delete"
  on storage.objects for delete
  to authenticated
  using ( /* same exists(...) as insert */ );
```

`storage.foldername(name)` splits the object path; `[1]` is the first folder = `<site_id>`. Casting to `uuid` also rejects malformed paths.

This keeps Storage consistent with the rest of the app: **RLS is the single access-control authority; the service role is never used on a request path.** Uploads go through the user's session client, and the policy enforces ownership exactly like table writes do.

---

## 5. Upload flow

Two viable shapes; we pick **client-direct upload with the session client**.

**Chosen: client-direct upload.**
1. In the image-swap UI, the user picks a file.
2. The browser Supabase client (`apps/web/lib/supabase/client.ts`, the anon/session client) calls `supabase.storage.from('site-media').upload(\`${siteId}/${uuid}.${ext}\`, file)`.
3. RLS `site_media_owner_insert` authorizes it against the user's session (they must own `siteId`).
4. On success, derive the public URL with `getPublicUrl(path)` and write it into the Image block's `src` via the editor's normal manual-edit path (no AI, no credits — manual edits are free per CLAUDE.md §6).

Why client-direct: it's the standard Supabase pattern, avoids streaming file bytes through a Next.js route handler (and its body-size/timeout limits), and the RLS policy already provides the authorization a server route would otherwise re-implement.

**Alternative considered — server-mediated upload** (file → Next.js route → service role → Storage). Rejected for Phase 1: it bypasses RLS (service role), reintroduces upload size/time limits at the function boundary, and duplicates the ownership check in app code. Revisit only if we need server-side processing (virus scan, format conversion) *before* the object lands — see §6.

---

## 6. Validation, limits, processing

Enforced client-side at minimum, and reinforced by bucket config where possible:

- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/svg+xml` (SVG with caution — see below). Settable as the bucket's `allowed_mime_types`.
- **Max object size:** start at **5 MB** per file (bucket `file_size_limit`). Revisit if hero images need more.
- **SVG risk:** SVGs can carry scripts. Because the bucket is public and served inline, either (a) exclude `image/svg+xml`, or (b) serve with `Content-Disposition: attachment` / sanitize. **Phase 1 recommendation: exclude SVG uploads**; allow only raster formats. Cheapest safe default.
- **Resizing / optimization:** out of scope for the bucket design. Delivery-time optimization (Supabase image transformations or Next/Image) is a separate decision at render time. If we ever need *ingest*-time conversion (e.g. force WebP), that's the one reason to move to a server-mediated upload (§5 alternative).
- **Filename normalization:** always rename to `<uuid>.<ext>`; never trust the client filename in the stored path.

---

## 7. Lifecycle & orphans

- **Unreferenced objects:** an upload writes an object immediately, but the document only references it once the user keeps the change. Swapping an image again, or deleting the block, leaves the old object orphaned. Phase 1 accepts a small amount of orphaned storage (cheap, and avoids racey delete-on-change logic). A later cleanup job can diff `site-media/<site_id>/*` against URLs present in that site's `content` + `draft_content` and delete the difference. **Not built in Phase 1; logged here so it isn't forgotten.**
- **Site deletion:** sites are soft-deleted (`deleted_at`), never hard-deleted (CLAUDE.md §5), so their media is intentionally retained too. If/when a hard-purge job exists, it removes the `site-media/<site_id>/` prefix as part of the purge.
- **Unpublish:** does **not** touch storage. Unpublishing hides the page; the image objects stay (the public bucket URL would still resolve if known, but nothing links to it once the page 404s). Acceptable for Phase 1.

---

## 8. What the founder must do in the dashboard

These steps can't be checked into code (bucket creation is dashboard/CLI, not a migration). Track alongside `SUPABASE_DASHBOARD_SETUP.md` when E5 is implemented:

1. **Storage → Create bucket** named `site-media`, **Public** = on.
2. Set **file size limit** = 5 MB and **allowed MIME types** to the raster list in §6 (exclude SVG).
3. Apply the `storage.objects` RLS policies from §4 (via the E5 migration, or pasted in the SQL editor if we keep storage policies dashboard-side — decide at implementation time; prefer the migration for reproducibility).

No new env vars or secrets are required — uploads use the existing anon/session client and the public URL is derived from `NEXT_PUBLIC_SUPABASE_URL`.

---

## 9. Open questions for implementation (E5)

- Keep storage RLS policies in a Drizzle migration vs. dashboard SQL? (Lean migration for reproducibility, but `storage.objects` is Supabase-owned — confirm migrations can target it cleanly in our setup.)
- Do we want a thin `apps/web/lib/storage/site-media.ts` helper (path builder + upload + getPublicUrl + typed errors) so the bucket name and path layout live in one place? (Recommended — mirrors how `lib/editor` contains editor specifics.)
- Image delivery optimization (Supabase transform vs Next/Image) — decide at render time, independent of this bucket design.
