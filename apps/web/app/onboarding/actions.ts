"use server";

import { redirect } from "next/navigation";

import { getCurrentAccount } from "@/lib/account";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export type OnboardingBasics = {
  businessName: string;
  industry?: string;
  city?: string;
};

export type OnboardingResult = { ok: true } | { ok: false; error: string };

// Create the user's business profile from the onboarding Basics step.
//
// The user is authenticated and their account resolved through the session
// client (RLS-gated). The profile INSERT itself goes through the service
// role: profiles has no INSERT policy by design — per the schema note,
// "inserts stay service-role only until Group C onboarding wires up
// app-side creation," which is exactly here. The action is the trusted
// boundary; it only ever writes a profile for an account it has already
// confirmed the caller owns.
export async function completeOnboarding(
  basics: OnboardingBasics,
): Promise<OnboardingResult> {
  const name = basics.businessName.trim();
  if (!name) {
    return { ok: false, error: "Business name is required." };
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const account = await getCurrentAccount();
  if (!account) {
    // Alpha provisions accounts via SQL; a missing one means the user
    // hasn't been set up yet. Surface it rather than silently failing.
    return {
      ok: false,
      error: "No account found for your login. Contact the site owner.",
    };
  }

  const admin = getSupabaseAdmin();

  // Guard against double-submit / re-onboarding: one profile per account.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("account_id", account.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    return { ok: true };
  }

  const { error } = await admin.from("profiles").insert({
    account_id: account.id,
    name,
    type: "business",
    data: {
      industry: basics.industry?.trim() || null,
      city: basics.city?.trim() || null,
    },
  });
  if (error) {
    return { ok: false, error: `Could not save profile: ${error.message}` };
  }

  return { ok: true };
}

// Server-action wrapper used directly as a <form action>; redirects to the
// sites list on success. Client form calls completeOnboarding instead so it
// can surface validation errors inline, but this keeps a no-JS fallback.
export async function onboardingFormAction(formData: FormData): Promise<void> {
  const result = await completeOnboarding({
    businessName: String(formData.get("businessName") ?? ""),
    industry: String(formData.get("industry") ?? ""),
    city: String(formData.get("city") ?? ""),
  });
  if (result.ok) {
    redirect("/app/sites");
  }
}
