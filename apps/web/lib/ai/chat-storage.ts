import "server-only";

import { getSupabaseServer } from "@/lib/supabase/server";

// Persistence for the editor chat transcript (CLAUDE.md §8 training pipe:
// "Every chat message (user + AI) with site context" + "Every edit
// operation"). Writes go through the RLS-enforced session client, so a row
// can only be written for a site the caller owns (chat_messages_owner_all,
// migration 0005).
//
// IMPORTANT: persistence is best-effort and NEVER fatal to a chat turn. The
// migration (0005) is committed but applied by the founder out-of-band
// (`pnpm db:migrate`), so until then the table doesn't exist and these calls
// will error — we swallow and log so the editor chat still works in-memory.

export type ChatRole = "user" | "assistant" | "tool";

export async function saveChatMessage(
  siteId: string,
  role: ChatRole,
  content: unknown,
): Promise<void> {
  try {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.from("chat_messages").insert({
      site_id: siteId,
      role,
      content,
    });
    if (error) {
      console.warn(
        `[chat-storage] could not persist ${role} message for site ${siteId}: ${error.message}`,
      );
    }
  } catch (err) {
    console.warn(
      `[chat-storage] persistence unavailable (migration 0005 applied?): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

export type StoredChatMessage = {
  id: string;
  role: ChatRole;
  content: unknown;
  createdAt: string;
};

// Load a site's transcript in chronological order. Returns [] on any failure
// (including the table not existing yet) so the editor renders an empty chat
// rather than crashing.
export async function loadChatMessages(
  siteId: string,
): Promise<StoredChatMessage[]> {
  try {
    const supabase = await getSupabaseServer();
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("site_id", siteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id as string,
      role: row.role as ChatRole,
      content: row.content,
      createdAt: row.created_at as string,
    }));
  } catch {
    return [];
  }
}
