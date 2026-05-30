CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chat_messages_role_check" CHECK ("chat_messages"."role" IN ('user', 'assistant', 'tool'))
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_site_id_created_at_idx" ON "chat_messages" USING btree ("site_id","created_at");--> statement-breakpoint

-- ── Hand-appended below (survives `db:generate` regeneration; re-paste if the
-- migration is rebased/renumbered per CLAUDE.md §5). Drizzle does not emit RLS
-- or grants. ────────────────────────────────────────────────────────────────

-- DML grants. 0003's ALTER DEFAULT PRIVILEGES should already cover tables
-- created after it, but we grant explicitly so this table's access doesn't
-- depend on migration ordering. No `anon` grant: chat is owner-only, there is
-- no public-facing policy. service_role bypasses RLS for server-side writes.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "chat_messages" TO authenticated, service_role;--> statement-breakpoint

-- Row-Level Security: a chat message is visible/writable only to the
-- authenticated user who owns the site it belongs to. Mirrors
-- "site_pages_owner_all" (migration 0002): join chat_messages → sites →
-- accounts and match accounts.user_id to auth.uid(). Without this policy the
-- table would return zero rows (CLAUDE.md §10 RLS gotcha).
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "chat_messages_owner_all" ON "chat_messages"
	FOR ALL TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM "sites"
			JOIN "accounts" ON "accounts"."id" = "sites"."account_id"
			WHERE "sites"."id" = "chat_messages"."site_id"
				AND "accounts"."user_id" = auth.uid()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "sites"
			JOIN "accounts" ON "accounts"."id" = "sites"."account_id"
			WHERE "sites"."id" = "chat_messages"."site_id"
				AND "accounts"."user_id" = auth.uid()
		)
	);