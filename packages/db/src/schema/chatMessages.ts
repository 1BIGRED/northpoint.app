import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { sites } from "./sites";

// One row per message in a site's editor AI chat (Group E8). This is both
// the conversation transcript the editor replays AND a training-data sink
// (CLAUDE.md §8: "Every chat message (user + AI) with site context" and
// "Every edit operation"). `role` mirrors the AI SDK message roles plus a
// synthetic `tool` row we write per apply_patch invocation so the
// before/after of every AI edit is captured.
//
// `content` is free-form jsonb: for user/assistant rows it's the UI message
// `parts` array; for tool rows it's `{ patch, ok, error, summary }`.
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "chat_messages_role_check",
      sql`${table.role} IN ('user', 'assistant', 'tool')`,
    ),
    // The editor loads a site's transcript in chronological order; index the
    // access path (site_id, created_at).
    index("chat_messages_site_id_created_at_idx").on(
      table.siteId,
      table.createdAt,
    ),
  ],
);

// role is constrained at the DB level too (the migration adds a CHECK); keep
// this list in sync with that constraint.
export const CHAT_MESSAGE_ROLES = ["user", "assistant", "tool"] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
