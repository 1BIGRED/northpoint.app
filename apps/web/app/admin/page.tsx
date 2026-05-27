import { redirect } from "next/navigation";

import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="text-sm text-muted-foreground">
        Admin dashboard placeholder. Signed in as{" "}
        <span className="font-mono">{user.email}</span>.
      </p>
      <form action="/api/auth/sign-out" method="post">
        <button
          type="submit"
          className="text-sm underline underline-offset-4 hover:no-underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
