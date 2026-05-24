import { getSupabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export default async function SupabaseDebugPage() {
  let status: "ok" | "error" = "ok";
  let detail = "";
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(unset)";

  try {
    const { error } = await getSupabase().auth.getSession();
    if (error) {
      status = "error";
      detail = error.message;
    }
  } catch (err) {
    status = "error";
    detail = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-2xl p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">Supabase debug</h1>
      <p className="text-sm text-gray-600 mb-6">
        Anon client → <code className="font-mono">{projectUrl}</code>
      </p>
      {status === "ok" ? (
        <div
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-900"
        >
          <p className="font-semibold">Supabase connected ✓</p>
          <p className="text-sm mt-1">
            Anon client reached the project and resolved a session call.
          </p>
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900"
        >
          <p className="font-semibold">Supabase connection failed ✗</p>
          <p className="text-sm mt-1 font-mono break-all">{detail}</p>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-6">
        Temporary debug route (A3). Remove once auth is wired up.
      </p>
    </main>
  );
}
