import { expect, type Page } from "@playwright/test";

/**
 * Product detail /products/[slug] (owner: product-page-agent). Buy box:
 * quantity picker + add-to-cart (Flight-signed server action — drive via UI).
 */
export class ProductPage {
  constructor(private readonly page: Page) {}

  async goto(slug: string): Promise<void> {
    await this.page.goto(`/products/${slug}`);
  }

  async expectTitle(name: string): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name })).toBeVisible();
  }

  async expectPrice(amount: string): Promise<void> {
    await expect(this.page.getByText(amount, { exact: true }).first()).toBeVisible();
  }

  /** Stock badge: "In stock" / "Out of stock" / "Only X left in stock". */
  async expectStockBadge(label: string | RegExp): Promise<void> {
    await expect(this.page.getByText(label).first()).toBeVisible();
  }

  /** Sets the buy-box quantity (stepper starts at 1 on every fresh visit). */
  async setQuantity(target: number): Promise<void> {
    for (let i = 1; i < target; i += 1) {
      await this.page.getByRole("button", { name: "Increase quantity" }).click();
    }
  }

  async expectQuantity(qty: number): Promise<void> {
    const value = this.page.locator(
      '[role="group"][aria-label="Quantity"] span[aria-live="polite"]',
    );
    await expect(value).toHaveText(String(qty));
  }

  async addToCart(): Promise<void> {
    await this.page.getByRole("button", { name: "Add to cart" }).click();
  }

  /** Header badge aria-label, e.g. "Cart, 2 items" (updates via cart context). */
  async expectBadge(count: number): Promise<void> {
    const noun = count === 1 ? "item" : "items";
    await expect(this.page.getByRole("link", { name: `Cart, ${count} ${noun}` })).toBeVisible();
  }

  async expectOutOfStock(): Promise<void> {
    await expect(this.page.getByRole("button", { name: "Out of stock" })).toBeDisabled();
  }

  async expectUnavailableNotice(): Promise<void> {
    await expect(this.page.getByText("This item is currently unavailable.")).toBeVisible();
  }
}
