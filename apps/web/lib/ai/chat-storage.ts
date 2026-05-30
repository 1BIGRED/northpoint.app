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

// A chat message shaped for the AI SDK's useChat (a UIMessage). `parts` is the
// stored parts array. Kept loosely typed here (server → client serialization);
// the panel casts it to UIMessage.
export type ChatHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  parts: unknown[];
};

// Load the transcript as seed messages for the chat panel. Only user and
// assistant rows are replayed — `tool` rows are a training-data record of
// each edit (their content is {patch,ok,...}), not conversational turns, so
// they'd corrupt the UI/model history. Malformed rows are skipped so one bad
// row can't break loading. RLS (the session client) scopes this to the owner.
export async function loadChatHistory(
  siteId: string,
): Promise<ChatHistoryMessage[]> {
  const rows = await loadChatMessages(siteId);
  const out: ChatHistoryMessage[] = [];
  for (const row of rows) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    if (!Array.isArray(row.content)) continue; // user/assistant store a parts[]
    out.push({ id: row.id, role: row.role, parts: row.content });
  }
  return out;
}
