import { test } from "@playwright/test";
import {
  ANGLE_GRINDER,
  DELIVERY_FEE_RWF,
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
 * place a COD_MOBILE_MONEY order → history shows it → detail renders the
 * payment instructions + method badge. Plus the guest-cart-after-register
 * client-state behavior.
 */
test.describe("Account", () => {
  test("register → empty history → mobile-money order → history → detail", async ({ page }) => {
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
      name: "E2E Customer",
      phone: "+250788000222",
      address: "KN 4 St, Kacyiru",
      city: "Kigali",
    });
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
    await success.expectTotal("50,000 RWF");
    await success.viewOrders();

    // History lists the new order (48,000 + 2,000 delivery), then detail.
    await history.expectOrderNumber();
    await history.openLatestOrder();

    const detail = new OrderDetailPage(page);
    await detail.expectOrderNumber();
    await detail.expectBadge("Pending");
    await detail.expectBadge("Pay on delivery — Mobile Money");
    await detail.expectItem(WHEELBARROW.name);
    await detail.expectTotal("50,000 RWF");
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