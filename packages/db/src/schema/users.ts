import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { authUsers } from "./auth";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);

// App-level mirror of auth.users. id matches auth.users.id 1:1 so we can
// FK against it; a trigger added in B3 will populate this row on insert
// into auth.users. Until then, rows are inserted manually per B5.
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
