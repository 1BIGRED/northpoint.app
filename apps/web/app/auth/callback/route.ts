import { NextResponse } from "next/server";

import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnTo = requestUrl.searchParams.get("returnTo");

  if (!code) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", "missing_code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await getSupabaseServer();
  const { data: exchange, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !exchange.session) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("error", exchangeError?.message ?? "exchange_failed");
    return NextResponse.redirect(loginUrl);
  }

  const userId = exchange.session.user.id;

  // Look up the user's account type to decide the destination. Uses service
  // role to bypass RLS — the just-authenticated session doesn't have a
  // public.users row yet on first login (the trigger that mirrors auth.users
  // lands as a follow-up migration in this PR).
  const admin = getSupabaseAdmin();
  const { data: account } = await admin
    .from("accounts")
    .select("id, type")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let destination: string;
  if (returnTo && returnTo.startsWith("/")) {
    destination = returnTo;
  } else if (account?.type === "admin") {
    destination = "/admin";
  } else if (account?.type === "client") {
    // Client accounts land on their sites list — unless they haven't been
    // through onboarding yet (no profile row), in which case start there.
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("account_id", account.id)
      .is("deleted_at", null)
      .maybeSingle();
    destination = profile ? "/app/sites" : "/onboarding";
  } else {
    // No account row yet (alpha provisions accounts via SQL). Send them to
    // onboarding, which surfaces a clear "contact the site owner" message
    // when it can't find an account.
    destination = "/onboarding";
  }

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
