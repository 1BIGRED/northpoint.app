CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" text,
	"type" text DEFAULT 'business' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profiles_type_check" CHECK ("profiles"."type" IN ('business', 'personal'))
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Row-Level Security: required for every public.* table per CLAUDE.md §10.
-- Account-owner can read + update their own profile rows. Inserts and deletes
-- stay service-role only until Group C onboarding wires up app-side creation.
-- (Service role bypasses RLS entirely; no policy needed for it.)

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "profiles_select_own" ON "profiles"
	FOR SELECT TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM "accounts"
			WHERE "accounts"."id" = "profiles"."account_id"
				AND "accounts"."user_id" = auth.uid()
		)
	);--> statement-breakpoint

CREATE POLICY "profiles_update_own" ON "profiles"
	FOR UPDATE TO authenticated
	USING (
		EXISTS (
			SELECT 1 FROM "accounts"
			WHERE "accounts"."id" = "profiles"."account_id"
				AND "accounts"."user_id" = auth.uid()
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "accounts"
			WHERE "accounts"."id" = "profiles"."account_id"
				AND "accounts"."user_id" = auth.uid()
		)
	);