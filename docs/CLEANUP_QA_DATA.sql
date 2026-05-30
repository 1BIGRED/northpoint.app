-- ============================================================================
-- CLEANUP_QA_DATA.sql — remove leftover QA test data from the live database
-- ============================================================================
--
-- DO NOT run this blindly. Run STEP 1 (preview) first, read the output, then
-- run STEP 2 (delete). Paste into the Supabase SQL editor.
--
-- This script was authored by Claude Code but intentionally NOT executed —
-- deleting from the live DB is the founder's call.
--
-- ----------------------------------------------------------------------------
-- DECISION: what gets deleted vs kept
-- ----------------------------------------------------------------------------
--   DELETE  → the `qa-e3@northpoint.test` user and everything under it
--             (1 profile, 2 sites, 1 published page, any chat messages).
--             Pure QA clutter — no reason to keep it.
--
--   KEEP    → everything under `chase.easter114@gmail.com`, including the
--             "BC Glass & Tint" profile/sites from provisioning + onboarding
--             tests. These are useful as demo data. This script never touches
--             chase's rows — the DELETE is scoped strictly to the qa-e3 email.
--
-- ----------------------------------------------------------------------------
-- HOW THE DELETE WORKS (foreign keys, all ON DELETE CASCADE)
-- ----------------------------------------------------------------------------
--   auth.users (id)
--     └─► public.users.id            (FK, ON DELETE CASCADE)
--           └─► accounts.user_id     (FK, ON DELETE CASCADE)
--                 ├─► profiles.account_id   (FK, ON DELETE CASCADE)
--                 └─► sites.account_id      (FK, ON DELETE CASCADE)
--                       ├─► site_pages.site_id     (FK, ON DELETE CASCADE)
--                       └─► chat_messages.site_id  (FK, ON DELETE CASCADE)
--
-- Because every link cascades, deleting the single `auth.users` row for the
-- qa-e3 account removes its public.users mirror, account, profile, sites,
-- pages, and chat messages in one statement. No manual ordering needed.
--
-- ============================================================================


-- ============================================================================
-- STEP 1 — PREVIEW (read-only). Run this ALONE first and confirm the rows are
-- exactly the qa-e3 test data and nothing belonging to chase.
-- ============================================================================

-- 1a. The target user (should be exactly one row, the qa-e3 test account).
SELECT id, email, created_at
FROM auth.users
WHERE email = 'qa-e3@northpoint.test';

-- 1b. Everything that will cascade-delete with that user.
WITH target AS (
  SELECT id FROM auth.users WHERE email = 'qa-e3@northpoint.test'
)
SELECT
  (SELECT count(*) FROM public.users   u WHERE u.id          IN (SELECT id FROM target))                                   AS users_rows,
  (SELECT count(*) FROM accounts        a WHERE a.user_id     IN (SELECT id FROM target))                                   AS accounts_rows,
  (SELECT count(*) FROM profiles        p WHERE p.account_id  IN (SELECT a.id FROM accounts a WHERE a.user_id IN (SELECT id FROM target)))                        AS profiles_rows,
  (SELECT count(*) FROM sites           s WHERE s.account_id  IN (SELECT a.id FROM accounts a WHERE a.user_id IN (SELECT id FROM target)))                        AS sites_rows,
  (SELECT count(*) FROM site_pages     sp WHERE sp.site_id    IN (SELECT s.id FROM sites s WHERE s.account_id IN (SELECT a.id FROM accounts a WHERE a.user_id IN (SELECT id FROM target)))) AS site_pages_rows,
  (SELECT count(*) FROM chat_messages   c WHERE c.site_id     IN (SELECT s.id FROM sites s WHERE s.account_id IN (SELECT a.id FROM accounts a WHERE a.user_id IN (SELECT id FROM target)))) AS chat_messages_rows;

-- 1c. SAFETY CHECK — confirm chase's data is NOT in scope (these counts are
-- just FYI; chase's rows must NOT appear in 1b above).
SELECT u.email, count(DISTINCT s.id) AS sites
FROM auth.users u
LEFT JOIN accounts a ON a.user_id = u.id
LEFT JOIN sites s ON s.account_id = a.id
WHERE u.email = 'chase.easter114@gmail.com'
GROUP BY u.email;


-- ============================================================================
-- STEP 2 — DELETE. Run ONLY after STEP 1 confirms the scope. Wrapped in a
-- transaction: review the post-delete counts, then COMMIT (or ROLLBACK).
-- ============================================================================

BEGIN;

-- Single cascading delete: removes the qa-e3 auth user and, via ON DELETE
-- CASCADE, its public.users row, account, profile, sites, pages, and chats.
DELETE FROM auth.users
WHERE email = 'qa-e3@northpoint.test';

-- Verify: this MUST return 0 (qa-e3 gone) and chase's site count UNCHANGED.
SELECT
  (SELECT count(*) FROM auth.users WHERE email = 'qa-e3@northpoint.test')        AS qa_e3_remaining, -- expect 0
  (SELECT count(*) FROM sites s
     JOIN accounts a ON a.id = s.account_id
     JOIN auth.users u ON u.id = a.user_id
   WHERE u.email = 'chase.easter114@gmail.com')                                  AS chase_sites;     -- expect: unchanged

-- If qa_e3_remaining = 0 and chase_sites looks right:
COMMIT;
-- Otherwise, run:  ROLLBACK;


-- ============================================================================
-- OPTIONAL (non-destructive) — if you later want to prune duplicate BC Glass
-- sites under chase from repeated onboarding tests, list them first and delete
-- specific ones BY ID manually. This script does NOT delete any of them.
-- ============================================================================
-- SELECT s.id, s.name, s.status, s.created_at
-- FROM sites s
-- JOIN accounts a ON a.id = s.account_id
-- JOIN auth.users u ON u.id = a.user_id
-- WHERE u.email = 'chase.easter114@gmail.com'
-- ORDER BY s.created_at;
--
-- Then, for a specific duplicate you choose to remove (cascades to its pages
-- and chat messages):
-- DELETE FROM sites WHERE id = '<paste-the-site-id-here>';
