import { test } from "@playwright/test";
import { ANGLE_GRINDER } from "../data";
import { CartPage } from "../pages/CartPage";
import { ProductPage } from "../pages/ProductPage";

/**
 * Journey: cart. Add from the product detail (qty 2) → line renders with
 * correct totals → stepper updates the total + badge → remove → empty state
 * with the browse-back CTA. Plus the fresh-visitor empty state.
 */
test.describe("Cart", () => {
  test("add qty 2 → stepper updates total → remove → empty state", async ({ page }) => {
    const product = new ProductPage(page);
    await product.goto(ANGLE_GRINDER.slug);
    await product.setQuantity(2);
    await product.addToCart();
    await product.expectBadge(2);

    // Cart line: name, quantity, line total (2 × 65,000), summary subtotal = total (no delivery fee).
    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectLine(ANGLE_GRINDER.name);
    await cart.expectQuantity(ANGLE_GRINDER.name, 2);
    await cart.expectLineTotal(ANGLE_GRINDER.name, "130,000 RWF");
    await cart.expectSummary({
      subtotal: "130,000 RWF",
      total: "130,000 RWF",
    });
    await cart.expectBadge(2);

    // Stepper: 2 → 3 updates the line total and the header badge.
    await cart.increaseQuantity(ANGLE_GRINDER.name);
    await cart.expectQuantity(ANGLE_GRINDER.name, 3);
    await cart.expectLineTotal(ANGLE_GRINDER.name, "195,000 RWF");
    await cart.expectBadge(3);

    // Remove → empty state + browse CTA.
    await cart.remove(ANGLE_GRINDER.name);
    await cart.expectEmpty();
    await cart.browseProducts();
  });

  test("empty cart renders empty state with browse CTA", async ({ page }) => {
    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectEmpty();
    await cart.browseProducts();
  });
});