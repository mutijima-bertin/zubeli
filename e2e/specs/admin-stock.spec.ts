import { test } from "@playwright/test";
import { SAFETY_VEST } from "../data";
import { OWNER_SESSION_PATH } from "../admin-session";
import { AdminStockPage } from "../pages/AdminStockPage";

// Owner session bootstrapped once per run in global-setup (login is
// rate-limited: 10/15min per email) — see e2e/admin-session.ts.
test.use({ storageState: OWNER_SESSION_PATH });

/**
 * Journey: admin stock (owner: stock-agent) on the seeded out-of-stock
 * safety vest.
 * - OUT (write-off) from zero is blocked client-side: warning + disabled save.
 * - IN restock (+10) toasts, flips the badge OUT -> in stock, and writes a
 *   RESTOCK row to the top of the movements ledger.
 */
test.describe("Admin — stock", () => {
  test("out-of-stock product: negative blocked, restock flips badge + ledger", async ({ page }) => {
    const stock = new AdminStockPage(page);
    await stock.gotoAsOwner();

    // Seeded: Hi-Vis Safety Vest stock 0, threshold 5 -> Out of stock.
    await stock.searchProduct(SAFETY_VEST.name);
    await stock.expectProductStatus(SAFETY_VEST.name, "Out of stock");
    await stock.expectLevelQty(SAFETY_VEST.name, "0");

    // OUT beyond stock is blocked before it reaches the server.
    await stock.openAdjust(SAFETY_VEST.name);
    await stock.selectDirection("Stock out (remove units)");
    await stock.expectReason("ADJUSTMENT"); // OUT forces the ADJUSTMENT reason
    await stock.fillQuantity("1");
    await stock.expectCannotGoNegative();

    // Switch to IN — reason resets to RESTOCK, submit unlocks.
    await stock.selectDirection("Stock in (add units)");
    await stock.expectReason("RESTOCK");
    await stock.fillQuantity("5");

    // Save -> toast + dialog closes + row updates (0 -> 5, LOW badge 5<=5).
    await stock.saveAdjustment();
    await stock.expectSuccessToast(SAFETY_VEST.name, "5");
    await stock.expectProductStatus(SAFETY_VEST.name, "Low stock");
    await stock.expectLevelQty(SAFETY_VEST.name, "5");

    // Ledger gained the newest movement for this product (+5 Restock).
    await stock.expectLedgerMovement(SAFETY_VEST.name, "+5", "Restock");

    // Fixture hygiene on the shared seeded DB: browse.spec.ts asserts that the
    // safety vest is OUT OF STOCK (seed fact, stock 0). Restore it so the
    // invariant still holds for any spec running after this one.
    await stock.openAdjust(SAFETY_VEST.name);
    await stock.selectDirection("Stock out (remove units)");
    await stock.fillQuantity("5");
    await stock.saveAdjustment();
    await stock.expectProductStatus(SAFETY_VEST.name, "Out of stock");
    await stock.expectLevelQty(SAFETY_VEST.name, "0");
  });
});