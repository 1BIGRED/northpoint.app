import { pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./users";

export const accountTypeEnum = pgEnum("account_type", ["admin", "client"]);

// One human can own multiple accounts. Phase 1 alpha gives the founder
// two: an `admin` account (their admin email) and a `client` account
// (BC Glass & Tint's owner email) — same person wears both hats.
// `accounts` lets us model that without conflating identity (users)
// with role-bearing workspace (accounts).
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: accountTypeEnum("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
