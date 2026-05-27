import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function requireEnv(): { url: string; anonKey: string; serviceRoleKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. See .env.example.",
    );
  }
  return { url, anonKey, serviceRoleKey };
}

// Cookie-bound Supabase client for Server Components, Route Handlers, and
// Server Actions. Reads + writes session cookies via next/headers.
export async function getSupabaseServer(): Promise<SupabaseClient> {
  const { url, anonKey } = requireEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        // Server Components can't mutate cookies; middleware handles refresh
        // for those paths. Swallowing the error here is the documented pattern.
        try {
          toSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // no-op
        }
      },
    },
  });
}

let cachedAdmin: SupabaseClient | null = null;

// Service-role client — bypasses RLS. Never expose to the browser. Only call
// from Route Handlers, Server Actions, or other server-only code.
export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const { url, serviceRoleKey } = requireEnv();
  cachedAdmin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}
