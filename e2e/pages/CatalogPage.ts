import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Catalog /products (owner: catalog-agent). Search, category filters,
 * cursor load-more, RWF prices. Filter links sit in a sidebar on lg+
 * viewports that the default test viewport (1280px) shows.
 */
export class CatalogPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/products");
  }

  async expectHeading(name: string): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name })).toBeVisible();
  }

  /** Product card title (h3 inside the shared ProductCard). */
  async expectProduct(name: string): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name })).toBeVisible();
  }

  async expectProductHidden(name: string): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name })).toHaveCount(0);
  }

  async expectPrice(amount: string): Promise<void> {
    await expect(this.page.getByText(amount, { exact: true }).first()).toBeVisible();
  }

  /** Live result count (`role=status`, e.g. "20 products"). */
  async expectResultCount(text: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("status").first()).toHaveText(text);
  }

  async expectLoadMore(): Promise<void> {
    await expect(this.page.getByRole("button", { name: "Load more tools" })).toBeVisible();
  }

  async search(term: string): Promise<void> {
    await this.page.getByLabel("Search products").fill(term);
    await this.page.getByRole("button", { name: "Submit search" }).click();
    await this.page.waitForURL(
      (url) => url.pathname === "/products" && url.searchParams.get("q") === term,
    );
  }

  async filterCategory(name: string): Promise<void> {
    const nav = this.page.getByRole("navigation", { name: "Category filters" });
    await nav.getByRole("link", { name: new RegExp(`^${name}`) }).click();
  }

  async openProduct(name: string): Promise<void> {
    await this.page.getByRole("link", { name: new RegExp(name) }).first().click();
  }
}