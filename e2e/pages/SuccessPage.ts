import { expect, type Page } from "@playwright/test";

/**
 * Order confirmation /checkout/success?order=<id> (owner: checkout-agent).
 * Public, hard-refresh safe. Only reached via a real order placement or a
 * deliberately crafted URL in guard tests.
 */
export class SuccessPage {
  constructor(private readonly page: Page) {}

  async expectHeading(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: "Order confirmed" })).toBeVisible();
  }

  /** Badge with the order number, e.g. "Order ZBL-A1B2C3D4". */
  async expectOrderNumber(): Promise<void> {
    await expect(this.page.getByText(/^Order (ZBL-[0-9A-F]{8})$/)).toBeVisible();
  }

  /** Extract the order number (ZBL-XXXXXXXX) for follow-up admin flows. */
  async orderNumber(): Promise<string> {
    const text = await this.page.getByText(/^Order (ZBL-[0-9A-F]{8})$/).innerText();
    const match = /ZBL-[0-9A-F]{8}/.exec(text);
    if (!match) throw new Error(`No ZBL order number found on the success page (got: ${text})`);
    return match[0];
  }

  async expectBadge(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  /** Items table row: product + quantity cell. */
  async expectItem(name: string, qty: number): Promise<void> {
    const row = this.page.getByRole("row").filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText(String(qty), { exact: true })).toBeVisible();
  }

  async expectTotal(amount: string): Promise<void> {
    await expect(this.page.getByText(amount, { exact: true }).first()).toBeVisible();
  }

  /** Provider instructions panel ("How to pay") contains the given copy. */
  async expectInstructionsToContain(text: string | RegExp): Promise<void> {
    await expect(this.page.getByText("How to pay")).toBeVisible();
    await expect(this.page.getByText(text)).toBeVisible();
  }

  async viewOrders(): Promise<void> {
    await this.page.getByRole("link", { name: "View your orders" }).click();
    await this.page.waitForURL(/\/account\/orders$/);
  }
}