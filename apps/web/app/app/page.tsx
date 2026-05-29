import { redirect } from "next/navigation";

import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// /app is just an entry point now — the real home is the sites list, which
// also handles the onboarding redirect for first-time users.
export default async function AppHomePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  redirect("/app/sites");
}
