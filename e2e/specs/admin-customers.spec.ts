import { expect, test } from "@playwright/test";
import { CUSTOMER_ERIC, CUSTOMER_UMUTONI, GUEST_CUSTOMER } from "../data";
import { OWNER_SESSION_PATH } from "../admin-session";
import { AdminCustomersPage } from "../pages/AdminCustomersPage";

// Owner session bootstrapped once per run in global-setup (login is
// rate-limited: 10/15min per email) — see e2e/admin-session.ts.
test.use({ storageState: OWNER_SESSION_PATH });

/**
 * Journey: admin customers (owner: customers-screen-agent).
 * - Seeded registered customers render without a Guest badge; seeded guest
 *   order snapshots (customerId null) render the Guest badge and are NOT
 *   linkable (no detail page exists for guests).
 * - A registered customer's detail page shows contact + KPI cards + the
 *   purchase-history table with seeded order numbers.
 */
test.describe("Admin — customers", () => {
  test("list shows registered and guest customers", async ({ page }) => {
    const customers = new AdminCustomersPage(page);
    await customers.gotoAsOwner();
    await customers.expectHeading();

    // Registered seeded customer: name + email, no Guest badge.
    await customers.expectCustomer(CUSTOMER_UMUTONI.name, { guest: false });

    // Guest order snapshot: name + phone, Guest badge, no detail link.
    await customers.expectCustomer(GUEST_CUSTOMER.name, { guest: true });
    await customers.expectGuestRowNotLinked(GUEST_CUSTOMER.name);

    // Second seeded registered customer is present too.
    await customers.expectCustomer(CUSTOMER_ERIC.name, { guest: false });
  });

  test("customer detail shows contact, KPIs and purchase history", async ({ page }) => {
    const customers = new AdminCustomersPage(page);
    await customers.gotoAsOwner();

    // Umutoni has the richest seeded purchase history.
    await customers.openDetail(CUSTOMER_UMUTONI.name, CUSTOMER_UMUTONI.email);
    await customers.expectDetailKpis();

    // Contact card + purchase history with seeded order numbers.
    await expect(page.getByText("Contact details", { exact: true })).toBeVisible();
    await customers.expectPurchaseHistory([
      "ZBL-00000015",
      "ZBL-00000013",
      "ZBL-00000010",
      "ZBL-00000007",
      "ZBL-00000001",
    ]);
  });
});