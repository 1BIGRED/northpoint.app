import { sql } from "drizzle-orm";
import { check, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { accounts } from "./accounts";

// One profile per account. `type` is the public-vs-business split that
// PLAN.md flags: Phase 1 only ships `business` (BC Glass), but
// `personal` is reserved here so Phase 2 doesn't need a migration to
// flip it on. `data` is intentionally jsonb so onboarding (Group C) can
// add fields without further migrations during early iteration.
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    name: text("name"),
    type: text("type").notNull().default("business"),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check("profiles_type_check", sql`${table.type} IN ('business', 'personal')`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
