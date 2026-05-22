# Supabase dashboard setup (manual)

Some Supabase configuration cannot be checked into code and must be done by the founder in the [Supabase dashboard](https://supabase.com/dashboard). This doc tracks what is required and where to set it.

## Required for Phase 1

### Authentication providers
**Where:** Authentication → Providers

- **Email** — enable. Used by the signup flow in B2.
- **Google OAuth** — enable. Used by the login flow in B3. Requires a Google Cloud OAuth client (Client ID + secret pasted into the Supabase dashboard).

Until these are enabled, B2/B3 auth flows will fail even if the code is correct.

### Email templates (optional, before beta)
**Where:** Authentication → Email Templates

The default templates work but say "Supabase" in the from name. Before sending invites to beta testers, customize the "Confirm signup" and "Magic link" templates to use the product placeholder (`{{PRODUCT_NAME}}` for now).

## Notes

- The auth provider settings live in the dashboard, not in env vars or code. If a login flow breaks unexpectedly, check the dashboard first.
- Anything sensitive (OAuth secrets, SMTP credentials) lives in the dashboard, not in `.env.local`. The app only ever sees the Supabase URL + keys.
