import { expect, test } from "@playwright/test";
import { dateDaysAgoInput, ORDER_NUMBER_RE } from "../data";
import { OWNER_SESSION_PATH } from "../admin-session";
import { AdminSalesPage } from "../pages/AdminSalesPage";

// Owner session bootstrapped once per run in global-setup (login is
// rate-limited: 10/15min per email) — see e2e/admin-session.ts.
test.use({ storageState: OWNER_SESSION_PATH });

/**
 * Journey: admin sales screens (owner: sales-agent).
 * - /admin overview: KPI band, revenue chart, top products and recent orders.
 * - /admin/sales: a URL-driven period renders the report KPIs; the period
 *   form pushes the query string and the server re-fetches the report.
 * The seeded orders sit within the last ~90 days, so a "from = 120 days
 * ago" window always contains revenue regardless of when the suite runs.
 */
test.describe("Admin — sales", () => {
  test("overview renders KPIs, chart, top products and recent orders", async ({ page }) => {
    const sales = new AdminSalesPage(page);
    await sales.gotoAsOwner("/admin");
    await sales.expectHeading("Dashboard overview");

    await sales.expectKpi("Total revenue", true);
    for (const kpi of ["Orders", "Avg order value", "Low stock", "Pending payments"]) {
      await sales.expectKpi(kpi);
    }
    await sales.expectChart();
    await sales.expectTopProducts();
    // Order numbers are ZBL- + 8 HEX chars (shared regex in ../data).
    await sales.expectRecentOrders(ORDER_NUMBER_RE);
  });

  test("sales report honors ?from&to and the period form updates the URL", async ({ page }) => {
    const from100 = dateDaysAgoInput(130); // covers every seeded order
    const today = dateDaysAgoInput(0);

    // Direct URL navigation: period drives the server-side report.
    const sales = new AdminSalesPage(page);
    await sales.gotoAsOwner(`/admin/sales?from=${from100}&to=${today}`);
    await sales.expectHeading("Sales reports");

    // Seeded paid/fulfilled orders fall inside the window -> real KPIs.
    await sales.expectKpi("Revenue", true);
    await sales.expectKpi("Orders");
    await sales.expectKpi("Paid orders");
    await sales.expectChart();
    await sales.expectTopProducts();

    // UI-driven period change: Apply pushes from/to into the URL.
    const from80 = dateDaysAgoInput(80);
    await sales.applyPeriod(from80, today);
    await expect(page).toHaveURL(
      (url) => url.searchParams.get("from") === from80 && url.searchParams.get("to") === today,
    );

    // FilterBar echoes the applied range as "X — Y" (en-GB date format; note
    // en-GB abbreviates September as "Sept" — 4 letters, hence {2,3}).
    await expect(
      page.getByText(/\d{1,2} [A-Z][a-z]{2,3} \d{4} — \d{1,2} [A-Z][a-z]{2,3} \d{4}/).first(),
    ).toBeVisible();
  });
});
