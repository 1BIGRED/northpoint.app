-- NOTE: drizzle-kit generated CREATE SCHEMA "auth" / CREATE TABLE
-- "auth"."users" because of the auth-schema shim in src/schema/auth.ts.
-- Supabase already owns and manages the auth schema, so those statements
-- are intentionally removed here. Drizzle's snapshot still tracks them
-- as "existing" so future migrations stay coherent.

CREATE TYPE "public"."user_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "account_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Row-Level Security: required for every public.* table per CLAUDE.md §10.
-- Phase 1 policies are minimal — authenticated users can SELECT their own
-- row only. All writes are service-role only until B3 wires up real flows.
-- (Service role bypasses RLS entirely; no policy needed for it.)

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "users_select_own" ON "users"
	FOR SELECT TO authenticated
	USING (auth.uid() = id);--> statement-breakpoint

CREATE POLICY "accounts_select_own" ON "accounts"
	FOR SELECT TO authenticated
	USING (auth.uid() = user_id);
