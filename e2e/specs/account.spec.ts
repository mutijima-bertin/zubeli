import { test } from "@playwright/test";
import {
  ANGLE_GRINDER,
  MOMO_COPY_RE,
  uniqueEmail,
  WHEELBARROW,
} from "../data";
import { AccountPage } from "../pages/AccountPage";
import { CartPage } from "../pages/CartPage";
import { CheckoutPage } from "../pages/CheckoutPage";
import { OrderDetailPage } from "../pages/OrderDetailPage";
import { OrderHistoryPage } from "../pages/OrderHistoryPage";
import { ProductPage } from "../pages/ProductPage";
import { RegisterPage } from "../pages/RegisterPage";
import { SuccessPage } from "../pages/SuccessPage";

/**
 * Journey: customer accounts. Register (unique email) → empty history →
 * place an order → history shows it → detail renders the payment instructions
 * + method badge. Plus the guest-cart-after-register client-state behavior.
 *
 * The order journey runs on COD_CASH — the payment picker's guaranteed
 * fallback, so it works under ANY `PAYMENT_METHODS` allowlist. The
 * mobile-money specifics (pay-at-door hint + MoMo instructions) are a
 * method-specific test that skips with an honest reason when the storefront is
 * configured without COD_MOBILE_MONEY.
 */
test.describe("Account", () => {
  test("register → empty history → cash order → history → detail", async ({ page }) => {
    const email = uniqueEmail("customer");

    const register = new RegisterPage(page);
    await register.goto();
    await register.register({
      name: "E2E Customer",
      email,
      phone: "+250788000222",
      password: "DemoPass2026!",
    });

    // Fresh account: prefilled profile + empty order history.
    const account = new AccountPage(page);
    await account.expectHeading();
    await account.expectEmailPrefilled(email);
    await account.viewOrderHistory();

    const history = new OrderHistoryPage(page);
    await history.expectEmpty();

    // Place a COD_CASH order while signed in.
    const product = new ProductPage(page);
    await product.goto(WHEELBARROW.slug);
    await product.addToCart();
    await product.expectBadge(1);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectLine(WHEELBARROW.name);
    await cart.proceedToCheckout();

    const checkout = new CheckoutPage(page);
    await checkout.fillShipping({
      name: "E2E Customer",
      phone: "+250788000222",
      address: "KN 4 St, Kacyiru",
      city: "Kigali",
    });

    // Cash is the picker's guaranteed fallback; guard honestly if a configured
    // allowlist removes even that, so the skip is never mistaken for a pass.
    const offered = await checkout.availablePaymentMethods();
    test.skip(!offered.includes("COD_CASH"), checkout.skipReasonFor("COD_CASH", offered));
    await checkout.selectPayment("COD_CASH");
    await checkout.placeOrder();

    // Confirmation shows the cash copy; signed-in CTA goes to history.
    const success = new SuccessPage(page);
    await success.expectHeading();
    await success.expectOrderNumber();
    await success.expectBadge("Pending");
    await success.expectBadge("Pay on delivery — Cash");
    await success.expectItem(WHEELBARROW.name, 1);
    await success.expectTotal("48,000 RWF");
    await success.viewOrders();

    // History lists the new order (48,000 subtotal = total — no delivery fee), then detail.
    await history.expectOrderNumber();
    await history.openLatestOrder();

    const detail = new OrderDetailPage(page);
    await detail.expectOrderNumber();
    await detail.expectBadge("Pending");
    await detail.expectBadge("Pay on delivery — Cash");
    await detail.expectItem(WHEELBARROW.name);
    await detail.expectTotal("48,000 RWF");
    await detail.expectInstructions("Cash on delivery", "Pay in cash when your order arrives.");
  });

  test("register → mobile-money order → history → detail", async ({ page }) => {
    // Method-specific journey: only meaningful when the configured allowlist
    // offers COD_MOBILE_MONEY. The guard runs as soon as the payment step is
    // on screen (the radios only render with a non-empty cart), so a skip is
    // visible with a reason instead of silently passing.
    const email = uniqueEmail("momo");

    const register = new RegisterPage(page);
    await register.goto();
    await register.register({
      name: "E2E Mobile Money",
      email,
      phone: "+250788000333",
      password: "DemoPass2026!",
    });

    const account = new AccountPage(page);
    await account.expectHeading();
    await account.expectEmailPrefilled(email);
    await account.viewOrderHistory();

    const history = new OrderHistoryPage(page);
    await history.expectEmpty();

    // Place a COD_MOBILE_MONEY order while signed in.
    const product = new ProductPage(page);
    await product.goto(WHEELBARROW.slug);
    await product.addToCart();
    await product.expectBadge(1);

    const cart = new CartPage(page);
    await cart.goto();
    await cart.expectLine(WHEELBARROW.name);
    await cart.proceedToCheckout();

    const checkout = new CheckoutPage(page);
    await checkout.fillShipping({
      name: "E2E Mobile Money",
      phone: "+250788000333",
      address: "KN 4 St, Kacyiru",
      city: "Kigali",
    });

    const offered = await checkout.availablePaymentMethods();
    test.skip(
      !offered.includes("COD_MOBILE_MONEY"),
      checkout.skipReasonFor("COD_MOBILE_MONEY", offered),
    );

    await checkout.selectPayment("COD_MOBILE_MONEY");
    await checkout.expectMoMoCopy();
    await checkout.placeOrder();

    // Confirmation shows mobile-money copy; signed-in CTA goes to history.
    const success = new SuccessPage(page);
    await success.expectHeading();
    await success.expectOrderNumber();
    await success.expectBadge("Pending");
    await success.expectBadge("Pay on delivery — Mobile Money");
    await success.expectItem(WHEELBARROW.name, 1);
    await success.expectTotal("48,000 RWF");
    await success.viewOrders();

    await history.expectOrderNumber();
    await history.openLatestOrder();

    const detail = new OrderDetailPage(page);
    await detail.expectOrderNumber();
    await detail.expectBadge("Pending");
    await detail.expectBadge("Pay on delivery — Mobile Money");
    await detail.expectItem(WHEELBARROW.name);
    await detail.expectTotal("48,000 RWF");
    await detail.expectInstructions("Mobile money on delivery", MOMO_COPY_RE);
  });

  test("guest cart still shows its line right after registering", async ({ page }) => {
    // Add to cart as a guest...
    const product = new ProductPage(page);
    await product.goto(ANGLE_GRINDER.slug);
    await product.addToCart();
    await product.expectBadge(1);

    // ...then register mid-flow (session created; cart_token stays).
    const email = uniqueEmail("guestcart");
    const register = new RegisterPage(page);
    await register.goto();
    await register.register({ name: "E2E Guest Cart", email, password: "DemoPass2026!" });

    // The mounted cart context keeps the guest line in the client session
    // (the server-side guest cart row is orphaned on register — known backlog).
    const cart = new CartPage(page);
    await cart.openViaBadge(1);
    await cart.expectLine(ANGLE_GRINDER.name);
    await cart.expectBadge(1);
  });
});