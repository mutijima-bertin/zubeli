import { expect, test } from "@playwright/test";
import { CUSTOMER_UMUTONI, DEMO_PASSWORD } from "../data";
import { AccountPage } from "../pages/AccountPage";
import { AdminPage } from "../pages/AdminPage";
import { LoginPage } from "../pages/LoginPage";

/**
 * Journey: admin login & guards.
 * - Owner sign-in through the middleware bounce lands on the dashboard with
 *   all six nav entries and the KPI band.
 * - Anonymous /admin -> /login?next=/admin (middleware).
 * - A CUSTOMER session (not OWNER) that pushes /admin is turned back to the
 *   storefront home — the dashboard shell never renders.
 */
test.describe("Admin — login & route guards", () => {
  test("owner signs in and sees the dashboard KPIs and nav", async ({ page }) => {
    const admin = new AdminPage(page);
    await admin.signInAsOwner("/admin");

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard overview" }),
    ).toBeVisible();
    await admin.expectSidebarLinks();

    // KPI band + chart + lists (seed guarantees revenue/orders data).
    // Scoped to main#main — "Orders" also matches the sidebar nav link.
    const main = page.locator("main#main");
    for (const kpi of ["Total revenue", "Orders", "Avg order value", "Low stock", "Pending payments"]) {
      await expect(main.getByText(kpi, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Revenue by month", { exact: true })).toBeVisible();
    await expect(page.getByText("Top products", { exact: true })).toBeVisible();
    await expect(page.getByText("Recent orders", { exact: true })).toBeVisible();
    await expect(page.getByText(/RWF/).first()).toBeVisible();

    // Signed-in-as bar shows the owner identity.
    await expect(page.getByText("owner@zubeli.rw", { exact: true })).toBeVisible();
  });

  test("logged-out guest bounces from /admin to /login?next=/admin", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin/);

    const login = new LoginPage(page);
    await login.expectPath();
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("customer (non-owner) is sent home from the dashboard", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto("/admin");
    await login.signIn(CUSTOMER_UMUTONI.email, DEMO_PASSWORD);

    // The sanctioned next path is pushed but middleware redirects non-OWNERs.
    await expect(page).toHaveURL((url) => url.pathname === "/");

    const admin = new AdminPage(page);
    await admin.expectNoSidebar();
    const account = new AccountPage(page);
    await account.expectUserName(CUSTOMER_UMUTONI.name);
  });
});