import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Cart /cart (owner: cart-agent). Line items bound to the shared cart
 * context; the header badge hydrates client-side after first mount — always
 * assert via the polling badge locator, never instantly.
 */
export class CartPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/cart");
  }

  /** Header cart link carrying the live item count. */
  cartBadge(count: number): Locator {
    const noun = count === 1 ? "item" : "items";
    return this.page.getByRole("link", { name: `Cart, ${count} ${noun}` });
  }

  /** Navigate via the header badge (client-side). */
  async openViaBadge(count: number): Promise<void> {
    await this.cartBadge(count).click();
    await this.page.waitForURL(/\/cart$/);
  }

  async expectBadge(count: number): Promise<void> {
    await expect(this.cartBadge(count)).toBeVisible();
  }

  private lineRow(name: string): Locator {
    return this.page.getByRole("listitem").filter({ hasText: name });
  }

  async expectLine(name: string): Promise<void> {
    await expect(this.page.getByRole("link", { name, exact: true })).toBeVisible();
  }

  async expectQuantity(name: string, qty: number): Promise<void> {
    // Stepper value span holds exactly "qty" — scoped to the line row so
    // prices with the same digits can never match.
    await expect(this.lineRow(name).getByText(String(qty), { exact: true })).toBeVisible();
  }

  async expectLineTotal(name: string, amount: string): Promise<void> {
    await expect(this.lineRow(name).getByText(amount, { exact: true })).toBeVisible();
  }

  async expectSummary(summary: { subtotal: string; total: string }): Promise<void> {
    await expect(this.page.getByText("Order summary")).toBeVisible();
    await expect(this.page.getByText(summary.subtotal, { exact: true }).first()).toBeVisible();
    await expect(this.page.getByText(summary.total, { exact: true }).first()).toBeVisible();
  }

  async increaseQuantity(name: string): Promise<void> {
    await this.lineRow(name).getByRole("button", { name: "Increase quantity" }).click();
  }

  async remove(name: string): Promise<void> {
    await this.lineRow(name).getByRole("button", { name: `Remove ${name} from cart` }).click();
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    await expect(this.page.getByRole("link", { name: "Browse products" })).toBeVisible();
  }

  async browseProducts(): Promise<void> {
    await this.page.getByRole("link", { name: "Browse products" }).click();
    await expect(this.page).toHaveURL(/\/products/);
  }

  async proceedToCheckout(): Promise<void> {
    await this.page.getByRole("link", { name: "Proceed to checkout" }).click();
    await this.page.waitForURL(/\/checkout$/);
  }
}