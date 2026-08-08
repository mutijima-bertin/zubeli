import { expect, type Page } from "@playwright/test";

/**
 * Order detail /account/orders/[id] (owner: account-agent). Status/method
 * badges, items table, totals, payment instructions (h3 title + steps).
 */
export class OrderDetailPage {
  constructor(private readonly page: Page) {}

  async expectOrderNumber(): Promise<void> {
    await expect(
      this.page.getByRole("heading", { level: 1, name: /^Order ZBL-[0-9A-F]{8}$/ }),
    ).toBeVisible();
  }

  async expectBadge(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  async expectItem(name: string): Promise<void> {
    await expect(this.page.getByRole("table").getByText(name, { exact: true })).toBeVisible();
  }

  async expectTotal(amount: string): Promise<void> {
    await expect(this.page.getByText(amount, { exact: true }).first()).toBeVisible();
  }

  /** Payment instructions card: h3 title + a step matching `stepContains`. */
  async expectInstructions(title: string, stepContains: string | RegExp): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 3, name: title })).toBeVisible();
    await expect(this.page.getByText(stepContains)).toBeVisible();
  }
}