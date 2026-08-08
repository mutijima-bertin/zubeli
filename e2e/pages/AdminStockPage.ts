import { expect, type Page } from "@playwright/test";
import { AdminPage } from "./AdminPage";

/**
 * /admin/stock (owner: stock-agent). The adjust dialog mirrors
 * stockAdjustSchema client-side AND server-side: OUT beyond current stock is
 * blocked (warning + disabled submit), successful adjustments toast via the
 * locally-mounted ToastProvider and the movements ledger re-fetches.
 */
export class AdminStockPage {
  constructor(private readonly page: Page) {}

  /** Bounce through the middleware guard and land on the stock screen. */
  async gotoAsOwner(): Promise<void> {
    const admin = new AdminPage(this.page);
    await admin.signInAsOwner("/admin/stock");
  }

  /** Narrow the stock table by product name (debounced client fetch). */
  async searchProduct(name: string): Promise<void> {
    await this.page.getByLabel("Search products").fill(name);
    await expect(this.productRow(name)).toBeVisible();
  }

  private productRow(name: string) {
    return this.page.getByRole("row").filter({ hasText: name });
  }

  async expectProductStatus(name: string, label: string): Promise<void> {
    await expect(this.productRow(name).getByText(label, { exact: true }).first()).toBeVisible();
  }

  /** Level cell "0 / 5" — assert the leading number only (fragile spacing).
   */
  async expectLevelQty(name: string, qty: string): Promise<void> {
    const row = this.productRow(name);
    await expect(row.getByText(qty, { exact: true }).first()).toBeVisible();
  }

  async openAdjust(name: string): Promise<void> {
    await this.productRow(name).getByRole("button", { name: "Adjust", exact: true }).click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  private dialog() {
    return this.page.getByRole("dialog");
  }

  async selectDirection(label: string): Promise<void> {
    await this.dialog().getByLabel("Action").selectOption({ label });
  }

  async expectReason(value: string): Promise<void> {
    await expect(this.dialog().getByLabel("Reason")).toHaveValue(value);
  }

  async fillQuantity(quantity: string): Promise<void> {
    const input = this.dialog().getByLabel("Quantity");
    await input.fill(quantity);
  }

  /** OUT beyond current stock → client-side warning + disabled submit. */
  async expectCannotGoNegative(): Promise<void> {
    await expect(this.dialog().getByText("Cannot go below zero", { exact: true })).toBeVisible();
    await expect(
      this.dialog().getByRole("button", { name: "Save adjustment", exact: true }),
    ).toBeDisabled();
  }

  async saveAdjustment(): Promise<void> {
    await this.dialog()
      .getByRole("button", { name: "Save adjustment", exact: true })
      .click();
    await expect(this.dialog()).toBeHidden();
  }

  /** Success toast from the locally-mounted ToastProvider. */
  async expectSuccessToast(name: string, stockQty: string): Promise<void> {
    await expect(this.page.getByText("Stock updated", { exact: true })).toBeVisible();
    await expect(
      this.page.getByText(`${name} now has ${stockQty} in stock.`, { exact: true }),
    ).toBeVisible();
  }

  /** Newest movement for the product in the ledger (refreshKey re-fetch). */
  async expectLedgerMovement(name: string, qtyLabel: string, reason: string): Promise<void> {
    const ledger = this.page.locator('section[aria-label="Stock movement ledger"]');
    const row = ledger.getByRole("row").filter({ hasText: name }).first();
    await expect(row.getByText(qtyLabel, { exact: true })).toBeVisible();
    await expect(row.getByText(reason, { exact: true })).toBeVisible();
  }
}