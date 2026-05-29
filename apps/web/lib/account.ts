import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";

// Account/profile lookups for the current authenticated user. All reads go
// through the cookie-bound session client — the accounts_select_own /
// profiles_select_own RLS policies gate them, so a user only ever sees
// their own rows.

export type CurrentAccount = {
  id: string;
  type: string;
};

// The user's primary (oldest, non-deleted) account, or null if they have
// none yet. Phase 1 alpha provisions accounts via SQL, so a real user
// generally has exactly one client account.
export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("accounts")
    .select("id, type")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id as string, type: data.type as string };
}

export type CurrentProfile = {
  id: string;
  accountId: string;
  name: string | null;
  type: string;
};

// The profile for a given account, or null if onboarding hasn't created
// one yet. Used to decide whether to route a user to /onboarding.
export async function getProfileForAccount(
  accountId: string,
): Promise<CurrentProfile | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, account_id, name, type")
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id as string,
    accountId: data.account_id as string,
    name: (data.name as string | null) ?? null,
    type: data.type as string,
  };
}
