-- Public read access for published pages (Group E6).
--
-- The public render route (/sites/[siteId]) serves unauthenticated
-- visitors, so it runs as the `anon` role. Migration 0003 deliberately
-- left anon ungranted "until a public-read policy exists" — this is that
-- policy.
--
-- Scope is deliberately narrow: anon may SELECT a site_pages row ONLY when
-- it is published (published_at IS NOT NULL) and not soft-deleted. Drafts
-- (draft_content) live in the same row but are never exposed because the
-- public query selects only `content`; even so, an unpublished row is
-- invisible to anon entirely. This keeps RLS the single access-control
-- authority — the render path uses the ordinary session client (anon when
-- logged out), never the service role.
--
-- We intentionally do NOT grant anon any access to `sites`: the public
-- page derives its title from the document itself (root.title), so site
-- names/domains stay private.

GRANT SELECT ON TABLE "site_pages" TO anon;--> statement-breakpoint

CREATE POLICY "site_pages_public_read" ON "site_pages"
	FOR SELECT TO anon
	USING (
		"published_at" IS NOT NULL
		AND "deleted_at" IS NULL
	);
