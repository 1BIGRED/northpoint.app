import { expect, test } from "@playwright/test";

test.describe("/debug/supabase", () => {
  test("renders and reports a connected Supabase client", async ({ page }) => {
    await page.goto("/debug/supabase");

    await expect(page.getByRole("heading", { name: "Supabase debug" })).toBeVisible();

    // The page renders one of two states. The CI smoke test asserts the
    // "connected" branch so a regression (env var rotation, RLS breakage,
    // unreachable project) shows up red instead of silently passing.
    await expect(
      page.getByRole("status").filter({ hasText: "Supabase connected" }),
    ).toBeVisible();
  });
});
