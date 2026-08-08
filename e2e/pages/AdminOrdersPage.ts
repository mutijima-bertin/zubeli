import { expect, type Page } from "@playwright/test";
import { AdminPage } from "./AdminPage";

/**
 * /admin/orders + /admin/orders/[id] (owner: orders-screen-agent).
 * All status transitions are Flight-signed server actions driven through
 * the StatusActions UI (never called directly), so the PO exercises the
 * real confirm-dialog flows. `main#main` scoping keeps feedback assertions
 * away from the Next.js DevTools banner.
 */
export class AdminOrdersPage {
  protected readonly main = this.page.locator("main#main");

  constructor(protected readonly page: Page) {}

  /** Bounce through the middleware guard and land on the orders list. */
  async gotoAsOwner(query = ""): Promise<void> {
    const admin = new AdminPage(this.page);
    await admin.signInAsOwner(`/admin/orders${query}`);
  }

  async expectHeading(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  }

  private orderRow(number: string) {
    return this.page.getByRole("row").filter({ hasText: number });
  }

  /** A row's order-status chip shows the given label (e.g. "Pending"). */
  async expectRowStatus(number: string, label: string): Promise<void> {
    await expect(this.orderRow(number).getByText(label, { exact: true })).toBeVisible();
  }

  async expectRowPayment(number: string, label: string): Promise<void> {
    await expect(this.orderRow(number).getByText(label, { exact: true })).toBeVisible();
  }

  /** Rows whose order number is filtered away (hasText would take substrings). */
  async expectRowAbsent(number: string): Promise<void> {
    await expect(this.page.getByRole("link", { name: number, exact: true })).toHaveCount(0);
  }

  /** Filter the list by order status via the URL-owned select. */
  async filterByStatus(label: string): Promise<void> {
    await this.page.getByLabel("Filter by order status").selectOption({ label });
    await expect(this.page).toHaveURL(/status=/);
  }

  /** Narrow by order number / customer via the search form + Search button. */
  async search(query: string): Promise<void> {
    await this.page.getByLabel("Search orders").fill(query);
    await this.page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(this.page.getByRole("link", { name: query, exact: true })).toBeVisible();
  }

  /** Open a row (whole-row link is the order number). */
  async openOrder(number: string): Promise<void> {
    await this.page.getByRole("link", { name: number, exact: true }).first().click();
    await expect(this.page.getByRole("heading", { level: 1, name: `Order ${number}` })).toBeVisible();
  }

  // --- detail page ---

  async expectDetailBadge(label: string): Promise<void> {
    await expect(this.page.getByText(label, { exact: true }).first()).toBeVisible();
  }

  /** A status-action button is either enabled or disabled (title hints it). */
  async expectStatusAction(name: string, disabled: boolean): Promise<void> {
    const button = this.page.getByRole("button", { name, exact: true });
    if (disabled) {
      await expect(button).toBeDisabled();
    } else {
      await expect(button).toBeEnabled();
    }
  }

  /**
   * Click a status action, confirm in the dialog, and wait for the success
   * feedback in the actions card. The dialog's confirm button shares the
   * trigger's label — always scope to the open dialog.
   */
  async performStatusAction(label: string): Promise<void> {
    await this.page.getByRole("button", { name: label, exact: true }).first().click();
    const dialog = this.page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(
      this.main.getByText("Order updated", { exact: true }).first(),
    ).toBeVisible();
  }
}