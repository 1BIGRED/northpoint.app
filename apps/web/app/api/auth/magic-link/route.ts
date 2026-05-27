import { NextResponse } from "next/server";

import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

function siteUrl(request: Request): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Fall back to the request origin (handles preview deploys + local dev).
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let body: { email?: unknown; returnTo?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; returnTo?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  const returnTo =
    typeof body.returnTo === "string" && body.returnTo.startsWith("/")
      ? body.returnTo
      : undefined;

  const callback = new URL("/auth/callback", siteUrl(request));
  if (returnTo) callback.searchParams.set("returnTo", returnTo);
  const emailRedirectTo = callback.toString();

  const isProd = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

  if (isProd) {
    // Real email send via Supabase default SMTP (Resend swap tracked for Group G).
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  // Non-prod (local dev + preview): generate the link via service role so we
  // can log it. Avoids dependence on email delivery during dev/Playwright runs.
  // Spec from TASK 1: "log the magic-link URL via console.info … when
  // NEXT_PUBLIC_VERCEL_ENV !== 'production'. This lets Playwright (and me)
  // grab the link from Vercel logs."
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: emailRedirectTo },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const actionLink = data?.properties?.action_link;
  if (actionLink) {
    console.info(`[magic-link] ${email} → ${actionLink}`);
  }
  return NextResponse.json({ ok: true, devLinkLogged: Boolean(actionLink) });
}
