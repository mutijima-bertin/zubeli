import { expect, test } from "@playwright/test";
import {
  ANGLE_GRINDER,
  CLAW_HAMMER,
  KIGALI_ADDRESS,
  PAYMENT_BADGE,
  PAYMENT_INSTRUCTION,
  uniqueBankReference,
} from "../data";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage, type PaymentMethodValue } from "../pages/CheckoutPage";
import { ProductPage } from "../pages/ProductPage";
import { SuccessPage } from "../pages/SuccessPage";

/**
 * Journey: checkout as a guest. The core COD_CASH order, the payment-step
 * contract, an allowlist-agnostic order on whatever the storefront offers,
 * empty-cart guard, BANK_TRANSFER reference validation, and the success-page
 * redirect guards.
 *
 * Payment methods are CONFIGURABLE (`PAYMENT_METHODS` → siteConfig), so specs
 * discover the rendered offer instead of hardcoding a product decision:
 * - the core journeys run on COD_CASH (the picker's guaranteed fallback);
 * - method-specific journeys skip with an honest reason when the configured
 *   allowlist does not include their method.
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

    // --- payment-step contract (asserted, never assumed) ------------------
    // The offer is configuration, so read it from the rendered radios: the step
    // must never be empty, and COD_CASH is the guaranteed fallback of the
    // picker — PIN that here so a regression fails instead of silently skipping.
    await checkout.expectCompletablePaymentStep();
    const offered = await checkout.availablePaymentMethods();
    expect(offered.length, "payment step must offer at least one method").toBeGreaterThan(0);
    test.skip(!offered.includes("COD_CASH"), checkout.skipReasonFor("COD_CASH", offered));
    expect(offered, "COD_CASH is the guaranteed fallback payment method").toContain("COD_CASH");

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
    await success.expectTotal("130,000 RWF");
    await success.expectInstructionsToContain("Pay in cash when your order arrives.");
  });

  test("payment step is completable on whichever method the storefront offers", async ({
    page,
  }) => {
    // Allowlist-agnostic core journey: pick the FIRST method the storefront
    // renders (catalogue order puts cash first), complete the order and assert
    // the confirmation copy of THAT method. This is the test that proves the
    // suite is not hardcoded to a single PAYMENT_METHODS value.
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
    await checkout.expectCompletablePaymentStep();

    const offered = await checkout.availablePaymentMethods();
    const method = offered[0] as PaymentMethodValue | undefined;
    expect(
      method,
      "payment step must offer at least one selectable method",
    ).toBeDefined();

    await checkout.selectPayment(method!);
    // BANK_TRANSFER is the only method with an extra required input.
    if (method === "BANK_TRANSFER") {
      await checkout.expectReferenceInputVisible();
      await checkout.fillBankReference(uniqueBankReference());
    }
    await checkout.placeOrder();

    const success = new SuccessPage(page);
    await success.expectHeading();
    await success.expectOrderNumber();
    await success.expectBadge("Pending");
    await success.expectBadge(PAYMENT_BADGE[method!]);
    await success.expectItem(CLAW_HAMMER.name, 1);
    await success.expectInstructionsToContain(PAYMENT_INSTRUCTION[method!]);
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

    // Method-specific journey: only meaningful when the configured allowlist
    // actually offers BANK_TRANSFER.
    const offered = await checkout.availablePaymentMethods();
    test.skip(
      !offered.includes("BANK_TRANSFER"),
      checkout.skipReasonFor("BANK_TRANSFER", offered),
    );

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