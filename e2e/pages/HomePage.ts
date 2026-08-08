import { expect, type Page } from "@playwright/test";

/**
 * Home / landing page (owner: homepage-agent). PO encapsulates selectors —
 * specs never use raw selectors.
 */
export class HomePage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/");
  }

  /** Hero headline — the storefront value prop. */
  async expectHeroVisible(): Promise<void> {
    await expect(
      this.page.getByRole("heading", {
        level: 1,
        name: "Construction tools in Rwanda, delivered where you work.",
      }),
    ).toBeVisible();
  }

  /** A seeded product card in the featured section (h3 inside ProductCard). */
  async expectFeaturedProduct(name: string): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name })).toBeVisible();
  }

  /** RWF-formatted price visible on the page. */
  async expectPrice(amount: string): Promise<void> {
    await expect(this.page.getByText(amount, { exact: true }).first()).toBeVisible();
  }

  async openProduct(name: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(name) }).first().click();
  }
}
