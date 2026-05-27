import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

// One row per editable site. `domain` is nullable while sites live on a
// Northpoint-managed subdomain; populated once a customer brings their
// own. `status` defaults to 'draft' and graduates to 'published' when
// Group F wires up publishing.
export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain"),
    status: text("status").notNull().default("draft"),
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
      "sites_status_check",
      sql`${table.status} IN ('draft', 'published', 'archived')`,
    ),
    // A custom domain may only point at one site at a time. NULL domains
    // are allowed to repeat (sites on the shared subdomain).
    uniqueIndex("sites_domain_unique")
      .on(table.domain)
      .where(sql`${table.domain} IS NOT NULL`),
  ],
);

export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
