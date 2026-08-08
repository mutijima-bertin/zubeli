import { expect, test } from "@playwright/test";
import {
  ANGLE_GRINDER,
  CLAW_HAMMER,
  KIGALI_ADDRESS,
  uniqueBankReference,
} from "../data";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { ProductPage } from "../pages/ProductPage";
import { SuccessPage } from "../pages/SuccessPage";

/**
 * Journey: checkout as a guest. COD_CASH happy path, empty-cart guard,
 * BANK_TRANSFER reference validation, and the success-page redirect guards.
 */
test.describe("Checkout — guest", () => {
  test("guest places a cash-on-delivery order and sees the confirmation", async ({ page }) => {
    // Browse → add 2 × Angle Grinder (65,000 RWF each).
    const product = new ProductPage(page);
    await product.goto(ANGLE_GRINDER.slug);
    await product.setQuantity(2);
    await product.addToCart();
    await product.expectBadge(2);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectLine(ANGLE_GRINDER.name);
    await cart.proceedToCheckout();

    const checkout = new CheckoutPage(page);
    await checkout.fillShipping(KIGALI_ADDRESS);
    await checkout.selectPayment("COD_CASH");
    await checkout.placeOrder();

    // Confirmation: order number + PENDING + method/status badges + items.
    const success = new SuccessPage(page);
    await success.expectHeading();
    await success.expectOrderNumber();
    await success.expectBadge("Pending");
    await success.expectBadge("Pay on delivery — Cash");
    await success.expectBadge("Awaiting payment");
    await success.expectItem(ANGLE_GRINDER.name, 2);
    await success.expectTotal("132,000 RWF");
    await success.expectInstructionsToContain("Pay in cash when your order arrives.");
  });

  test("empty cart checkout renders the empty state — no form", async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.expectEmptyCart();
  });

  test("bank transfer requires a reference — error, then success shows it", async ({ page }) => {
    const reference = uniqueBankReference();

    const product = new ProductPage(page);
    await product.goto(CLAW_HAMMER.slug);
    await product.addToCart();
    await product.expectBadge(1);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectLine(CLAW_HAMMER.name);
    await cart.proceedToCheckout();

    const checkout = new CheckoutPage(page);
    await checkout.fillShipping(KIGALI_ADDRESS);
    await checkout.selectPayment("BANK_TRANSFER");
    await checkout.expectReferenceInputVisible();

    // No reference → client-side field error, order NOT placed.
    await checkout.clickPlaceOrder();
    await checkout.expectFieldError("Enter the reference you'll use on your transfer");
    await checkout.expectNoOrderPlaced();

    // With a reference → success; the instructions echo the reference.
    await checkout.fillBankReference(reference);
    await checkout.placeOrder();

    const success = new SuccessPage(page);
    await success.expectHeading();
    await success.expectOrderNumber();
    await success.expectBadge("Pending");
    await success.expectBadge("Bank transfer");
    // Production copy echoes the order number, not the customer reference.
    await success.expectInstructionsToContain(/order number ZBL-[0-9A-F]{8} as your transfer reference/);
  });

  test("success page redirects home for missing or unknown order ids", async ({ page }) => {
    const onHome = (url: URL) => url.pathname === "/";

    await page.goto("/checkout/success");
    await expect(page).toHaveURL(onHome);

    await page.goto("/checkout/success?order=nonexistent");
    await expect(page).toHaveURL(onHome);
  });
});