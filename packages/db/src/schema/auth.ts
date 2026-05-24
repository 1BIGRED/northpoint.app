import { pgSchema, uuid } from "drizzle-orm/pg-core";

// Supabase Auth owns the `auth` schema — we never migrate or mutate it.
// This shim exists so our own tables can declare proper FK relationships
// to `auth.users.id` without Drizzle trying to manage that schema.
export const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});
