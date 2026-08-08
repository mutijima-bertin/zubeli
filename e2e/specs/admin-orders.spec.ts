import { expect, test } from "@playwright/test";
import {
  CLAW_HAMMER,
  ORDER_CANCELLED_SEED,
  ORDER_PENDING_BANK_TRANSFER,
  uniquePhone,
} from "../data";
import { OWNER_SESSION_PATH } from "../admin-session";
import { AdminOrdersPage } from "../pages/AdminOrdersPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { ProductPage } from "../pages/ProductPage";
import { SuccessPage } from "../pages/SuccessPage";

// Owner session bootstrapped once per run in global-setup (login is
// rate-limited: 10/15min per email) — see e2e/admin-session.ts.
test.use({ storageState: OWNER_SESSION_PATH });

/**
 * Journey: admin order management.
 * 1. List: seeded orders render with the right status chips; URL filters work.
 * 2. BANK_TRANSFER PENDING order: Confirm payment (no extra reference step —
 *    stored on the order) -> PAID persists across reload -> Fulfill -> FULFILLED.
 * 3. A dedicated fresh storefront order is cancelled and restocked — state is
 *    consumed in-spec so sibling specs never see mutated seed rows.
 */
test.describe("Admin — orders", () => {
  test("orders list shows seeded statuses and URL filters", async ({ page }) => {
    const orders = new AdminOrdersPage(page);
    await orders.gotoAsOwner();
    await orders.expectHeading();

    // Seeded rows carry their lifecycle chips (ZBL-15 PENDING newest, ZBL-11 CANCELLED).
    await orders.expectRowStatus("ZBL-00000015", "Pending");
    await orders.expectRowPayment("ZBL-00000015", "Awaiting payment");
    await orders.expectRowStatus(ORDER_CANCELLED_SEED, "Cancelled");
    await orders.expectRowStatus(ORDER_PENDING_BANK_TRANSFER.number, "Pending");

    // Status filter drives the URL and narrows rows (Cancelled row disappears).
    await orders.filterByStatus("Pending");
    await expect(page).toHaveURL(/status=PENDING/);
    await orders.expectRowStatus(ORDER_PENDING_BANK_TRANSFER.number, "Pending");
    await orders.expectRowAbsent(ORDER_CANCELLED_SEED);

    // Order-number search narrows to exactly that row.
    await orders.search(ORDER_PENDING_BANK_TRANSFER.number);
    await orders.expectRowStatus(ORDER_PENDING_BANK_TRANSFER.number, "Pending");
  });

  test("confirm bank-transfer payment then fulfill — persisted across reload", async ({ page }) => {
    const orders = new AdminOrdersPage(page);
    await orders.gotoAsOwner();
    await orders.search(ORDER_PENDING_BANK_TRANSFER.number);
    await orders.openOrder(ORDER_PENDING_BANK_TRANSFER.number);

    // BANK_TRANSFER order: stored reference visible, no re-entry needed.
    await orders.expectDetailBadge("Pending");
    await expect(page.getByText(ORDER_PENDING_BANK_TRANSFER.ref, { exact: true })).toBeVisible();
    await expect(
      page.getByText("Bank transfer", { exact: true }).first(),
    ).toBeVisible();

    // PENDING gating: confirm+cancel enabled, fulfill+refund disabled.
    await orders.expectStatusAction("Confirm payment", false);
    await orders.expectStatusAction("Cancel", false);
    await orders.expectStatusAction("Fulfill", true);
    await orders.expectStatusAction("Refund", true);

    // Confirm payment -> PAID (bank ref already stored).
    await orders.performStatusAction("Confirm payment");
    await orders.expectDetailBadge("Paid");
    await orders.expectStatusAction("Confirm payment", true);

    // Reload proves the server persisted the transition.
    await page.reload();
    await orders.expectDetailBadge("Paid");
    await orders.expectStatusAction("Confirm payment", true);
    await orders.expectStatusAction("Fulfill", false);

    // PAID -> FULFILLED.
    await orders.performStatusAction("Fulfill");
    await orders.expectDetailBadge("Fulfilled");
    await orders.expectStatusAction("Fulfill", true);
    await orders.expectStatusAction("Refund", false);
  });

  test("cancel a fresh storefront order and restock", async ({ page }) => {
    // A dedicated order placed through the storefront (never a seed row),
    // so the run's other specs stay deterministic.
    const phone = uniquePhone();
    const product = new ProductPage(page);
    await product.goto(CLAW_HAMMER.slug);
    await product.addToCart();
    await product.expectBadge(1);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectLine(CLAW_HAMMER.name);
    await cart.proceedToCheckout();

    const checkout = new CheckoutPage(page);
    await checkout.fillShipping({
      name: "E2E Cancel Guest",
      phone,
      address: "KN 5 St, Nyarugenge",
      city: "Kigali",
    });
    await checkout.selectPayment("COD_CASH");
    await checkout.placeOrder();

    const success = new SuccessPage(page);
    await success.expectHeading();
    const orderNumber = await success.orderNumber();

    // Owner finds the fresh order by number and cancels it.
    const orders = new AdminOrdersPage(page);
    await orders.gotoAsOwner();
    await orders.search(orderNumber);
    await orders.openOrder(orderNumber);

    await orders.expectDetailBadge("Pending");
    await orders.expectDetailBadge("Pay on delivery — Cash");
    await orders.expectStatusAction("Confirm payment", false);
    await orders.expectStatusAction("Cancel", false);

    await orders.performStatusAction("Cancel");
    await orders.expectDetailBadge("Cancelled");
    await orders.expectStatusAction("Cancel", true);
    await orders.expectStatusAction("Confirm payment", true);
  });
});