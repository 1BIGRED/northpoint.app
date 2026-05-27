import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { sites } from "./sites";

// One row per page in a site. `content` is the live (published) state;
// `draft_content` is the editor's in-progress state. Publishing swaps
// draft → content and stamps `published_at`. Both columns are nullable
// because brand-new pages start as a blank draft before any save.
export const sitePages = pgTable(
  "site_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: jsonb("content"),
    draftContent: jsonb("draft_content"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Paths are unique within a site (you can't have two "/about" pages on
    // one site). Soft-deleted rows still occupy their path slot — un-delete
    // and rename, don't insert a duplicate.
    uniqueIndex("site_pages_site_id_path_unique").on(table.siteId, table.path),
  ],
);

export type SitePage = typeof sitePages.$inferSelect;
export type NewSitePage = typeof sitePages.$inferInsert;
