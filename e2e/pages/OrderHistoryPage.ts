import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Order history /account/orders (owner: account-agent). Mobile cards + a
 * desktop table; at the default 1280px viewport the table is the visible
 * rendering, so order links are scoped to the table (the mobile cards are
 * display:none but still carry roles).
 */
export class OrderHistoryPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/account/orders");
  }

  private table(): Locator {
    return this.page.getByRole("table");
  }

  async expectEmpty(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  }

  /** Newest order is on top — assert its number link shows in the table. */
  async expectOrderNumber(): Promise<void> {
    await expect(this.table().getByRole("link", { name: /^ZBL-[0-9A-F]{8}$/ })).toBeVisible();
  }

  async openLatestOrder(): Promise<void> {
    await this.table().getByRole("link", { name: /^ZBL-[0-9A-F]{8}$/ }).first().click();
    await this.page.waitForURL(/\/account\/orders\/[^/]+$/);
  }
}