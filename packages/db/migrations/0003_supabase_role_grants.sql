-- Supabase API-role DML grants.
--
-- WHY: Our tables are created by Drizzle migrations rather than through the
-- Supabase dashboard, so the platform's default privileges granted only
-- REFERENCES/TRIGGER/TRUNCATE to the API roles — NOT the DML privileges
-- (SELECT/INSERT/UPDATE/DELETE) that the authenticated and service_role roles
-- need.
--
-- Without DML grants, every PostgREST query (the supabase-js client) is
-- rejected at the table-privilege layer with "permission denied for table X",
-- *before* RLS is ever consulted. This even affects service_role: BYPASSRLS
-- skips RLS *policies* but does not waive the table-level GRANT check.
--
-- SECURITY MODEL: Row access stays gated by the RLS policies defined in the
-- prior migrations (0000–0002). These grants only let a query reach the RLS
-- layer; the policies decide which rows it sees. service_role bypasses RLS by
-- design (server-side/admin use). authenticated sees only the rows its
-- policies permit.
--
-- SCOPE: deliberately NOT granting anything to `anon`. No table has an
-- anon-facing RLS policy yet, so anon would see zero rows regardless. Public
-- read access for the published-site render route is added later, scoped to
-- SELECT on the specific tables, alongside the policy that enables it.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "users"      TO authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "accounts"   TO authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "profiles"   TO authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "sites"      TO authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "site_pages" TO authenticated, service_role;--> statement-breakpoint

-- Future-proofing: ensure tables created later by this role automatically
-- grant the same DML privileges, so new migrations don't silently repeat the
-- "permission denied" failure above.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
	GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
