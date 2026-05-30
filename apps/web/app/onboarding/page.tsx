import { redirect } from "next/navigation";

import { getCurrentAccount, getProfileForAccount } from "@/lib/account";
import { getSupabaseServer } from "@/lib/supabase/server";

import { OnboardingForm } from "./onboarding-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?returnTo=/onboarding");
  }

  const account = await getCurrentAccount();
  // Already onboarded? Don't show the form again — send them to their sites.
  if (account) {
    const profile = await getProfileForAccount(account.id);
    if (profile) {
      redirect("/app/sites");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to Northpoint
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your business to get started. You can change any of
          this later.
        </p>
      </div>
      <div className="mt-8">
        <OnboardingForm />
      </div>
    </main>
  );
}
