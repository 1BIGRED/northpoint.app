"use server";

import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/account";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

// Profile fields editable from settings. `name` is a column; industry/city
// live in the profile's `data` jsonb (the shape onboarding writes). Each is
// optional so the client can save one field at a time on blur.
export type ProfileUpdate = {
  name?: string;
  industry?: string;
  city?: string;
};

// Update the current account's profile. Runs through the session client —
// profiles_update_own gates it to the caller's own profile. industry/city are
// merged into the existing `data` jsonb so an unrelated key (added later) is
// never clobbered by a single-field save.
export async function updateProfile(
  update: ProfileUpdate,
): Promise<SettingsResult> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "No account found." };

  const supabase = await getSupabaseServer();
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("id, data")
    .eq("account_id", account.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError || !current) {
    return { ok: false, error: "Couldn't load your profile." };
  }

  const existingData = (current.data ?? {}) as Record<string, unknown>;
  const nextData: Record<string, unknown> = { ...existingData };
  if (update.industry !== undefined) {
    nextData.industry = update.industry.trim() || null;
  }
  if (update.city !== undefined) {
    nextData.city = update.city.trim() || null;
  }

  const patch: Record<string, unknown> = {
    data: nextData,
    updated_at: new Date().toISOString(),
  };
  if (update.name !== undefined) {
    patch.name = update.name.trim() || null;
  }

  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", current.id);
  if (error) {
    return { ok: false, error: `Couldn't save: ${error.message}` };
  }
  return { ok: true };
}

// Delete the current account. This is a SOFT delete (sets deleted_at on the
// account, its profile, and its sites) per CLAUDE.md §5 "never hard delete
// user data" — every query already filters deleted_at, so everything
// disappears but is recoverable. accounts has no UPDATE RLS policy, so the
// writes go through the service-role client AFTER getCurrentAccount (itself
// RLS-scoped) has confirmed the caller owns this account — the action is the
// trusted boundary, same pattern as onboarding's profile insert.
//
// On success it signs the user out and redirects to /login.
export async function deleteAccount(
  confirmation: string,
): Promise<SettingsResult> {
  if (confirmation.trim().toLowerCase() !== "delete") {
    return { ok: false, error: 'Type "delete" to confirm.' };
  }

  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "No account found." };

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Soft-delete the account's content, scoped explicitly by account id since
  // the admin client bypasses RLS.
  const { error: sitesError } = await admin
    .from("sites")
    .update({ deleted_at: now })
    .eq("account_id", account.id)
    .is("deleted_at", null);
  if (sitesError) {
    return { ok: false, error: `Couldn't delete sites: ${sitesError.message}` };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ deleted_at: now })
    .eq("account_id", account.id)
    .is("deleted_at", null);
  if (profileError) {
    return {
      ok: false,
      error: `Couldn't delete profile: ${profileError.message}`,
    };
  }

  const { error: accountError } = await admin
    .from("accounts")
    .update({ deleted_at: now })
    .eq("id", account.id)
    .is("deleted_at", null);
  if (accountError) {
    return {
      ok: false,
      error: `Couldn't delete account: ${accountError.message}`,
    };
  }

  // End the session and bounce to login. redirect() throws to navigate, so it
  // must come after every fallible step.
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
