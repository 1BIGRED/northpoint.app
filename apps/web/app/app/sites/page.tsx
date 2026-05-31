import { redirect } from "next/navigation";

import { getCurrentAccount, getProfileForAccount } from "@/lib/account";
import { getSupabaseServer } from "@/lib/supabase/server";

import { CreateSiteButton } from "./create-site-button";
import { ImportSiteButton } from "./import-site-button";
import { SiteListItem } from "./site-list-item";

export const dynamic = "force-dynamic";

type SiteRow = {
  id: string;
  name: string;
  status: string;
  updated_at: string;
};

export default async function SitesListPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?returnTo=/app/sites");
  }

  // First-time users (no profile yet) go through onboarding first.
  const account = await getCurrentAccount();
  if (!account) {
    redirect("/onboarding");
  }
  const profile = await getProfileForAccount(account.id);
  if (!profile) {
    redirect("/onboarding");
  }

  // RLS (sites_owner_all) scopes this to the user's own sites.
  const { data, error } = await supabase
    .from("sites")
    .select("id, name, status, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`load sites failed: ${error.message}`);
  }
  const sites = (data ?? []) as SiteRow[];

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your sites</h1>
          <p className="text-sm text-muted-foreground">
            {profile.name ? `${profile.name} · ` : ""}
            {sites.length} {sites.length === 1 ? "site" : "sites"}
          </p>
        </div>
        <form action="/api/auth/sign-out" method="post">
          <button
            type="submit"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </form>
      </div>

      <section className="space-y-4 rounded-lg border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium">Create a new site</h2>
            <p className="text-xs text-muted-foreground">
              Start from a template that fits your business.
            </p>
          </div>
          <CreateSiteButton />
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div>
            <h2 className="text-sm font-medium">Have an existing site?</h2>
            <p className="text-xs text-muted-foreground">
              Import its name, hours, and contact info as an editable draft.
            </p>
          </div>
          <ImportSiteButton />
        </div>
      </section>

      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No sites yet. Create your first one above.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {sites.map((site) => (
            <SiteListItem
              key={site.id}
              id={site.id}
              name={site.name}
              status={site.status}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
