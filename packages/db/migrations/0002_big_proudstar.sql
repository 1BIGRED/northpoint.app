CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text NOT NULL,
	"domain" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sites_status_check" CHECK ("sites"."status" IN ('draft', 'published', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"path" text NOT NULL,
	"content" jsonb,
	"draft_content" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sites_domain_unique" ON "sites" USING btree ("domain") WHERE "sites"."domain" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "site_pages_site_id_path_unique" ON "site_pages" USING btree ("site_id","path");--> statement-breakpoint

-- Row-Level Security: required for every public.* table per CLAUDE.md §10.
-- Account owner manages their sites (full CRUD) — per TASK 4A spec
-- "account owner manages their sites and pages". Service role bypasses RLS.

ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "site_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "sites_owner_all" ON "sites"
	FOR ALL TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM "accounts"
			WHERE "accounts"."id" = "sites"."account_id"
				AND "accounts"."user_id" = auth.uid()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "accounts"
			WHERE "accounts"."id" = "sites"."account_id"
				AND "accounts"."user_id" = auth.uid()
		)
	);--> statement-breakpoint

CREATE POLICY "site_pages_owner_all" ON "site_pages"
	FOR ALL TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM "sites"
			JOIN "accounts" ON "accounts"."id" = "sites"."account_id"
			WHERE "sites"."id" = "site_pages"."site_id"
				AND "accounts"."user_id" = auth.uid()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "sites"
			JOIN "accounts" ON "accounts"."id" = "sites"."account_id"
			WHERE "sites"."id" = "site_pages"."site_id"
				AND "accounts"."user_id" = auth.uid()
		)
	);