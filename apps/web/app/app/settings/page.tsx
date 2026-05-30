import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentAccount, getProfileForAccount } from "@/lib/account";
import { getSupabaseServer } from "@/lib/supabase/server";

import { AppNav } from "../app-nav";
import { DangerZone } from "./danger-zone";
import { ProfileSettings } from "./profile-settings";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SettingsPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?returnTo=/app/settings");
  }

  const account = await getCurrentAccount();
  if (!account) {
    redirect("/onboarding");
  }
  const profile = await getProfileForAccount(account.id);
  if (!profile) {
    redirect("/onboarding");
  }

  // Account creation date (the accounts row's created_at).
  const { data: accountRow } = await supabase
    .from("accounts")
    .select("created_at")
    .eq("id", account.id)
    .maybeSingle();

  // industry/city live in profiles.data (jsonb); getProfileForAccount doesn't
  // select it, so read it here directly. RLS scopes it to the caller.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("data")
    .eq("account_id", account.id)
    .is("deleted_at", null)
    .maybeSingle();

  // Site count for the Sites section. RLS scopes this to the user's own sites.
  const { count: siteCount } = await supabase
    .from("sites")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);

  const data = (profileRow?.data ?? {}) as Record<string, unknown>;
  const industry = typeof data.industry === "string" ? data.industry : "";
  const city = typeof data.city === "string" ? data.city : "";
  const sites = siteCount ?? 0;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your business profile and account.
          </p>
        </div>

        <ProfileSettings
          initialName={profile.name ?? ""}
          initialIndustry={industry}
          initialCity={city}
        />

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Account</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email ?? "—"}</dd>
            <dt className="text-muted-foreground">Member since</dt>
            <dd>{formatDate(accountRow?.created_at as string | undefined)}</dd>
          </dl>
          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Sign out
            </button>
          </form>
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium">Sites</h2>
          <p className="text-sm text-muted-foreground">
            You have {sites} {sites === 1 ? "site" : "sites"}.
          </p>
          <Link
            href="/app/sites"
            className="inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
          >
            Manage sites
          </Link>
        </section>

        <DangerZone />
      </main>
    </>
  );
}
