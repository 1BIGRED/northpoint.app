"use server";

import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/account";
import { getSupabaseServer } from "@/lib/supabase/server";

// Create a new site for the current user's account, then drop them into the
// editor for it. The INSERT runs through the session client: the
// sites_owner_all RLS policy's WITH CHECK confirms the account_id belongs to
// the caller, so this can't create a site under someone else's account.
export async function createSite(formData: FormData): Promise<void> {
  const rawName = String(formData.get("name") ?? "").trim();
  const name = rawName || "Untitled site";

  const account = await getCurrentAccount();
  if (!account) {
    redirect("/onboarding");
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("sites")
    .insert({ account_id: account.id, name, status: "draft" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`createSite failed: ${error?.message ?? "no row returned"}`);
  }

  // Straight into the editor (route ships in E3 / #23).
  redirect(`/app/sites/${data.id}/edit`);
}
