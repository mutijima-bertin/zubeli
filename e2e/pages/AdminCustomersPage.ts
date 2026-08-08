import { expect, type Page } from "@playwright/test";
import { AdminPage } from "./AdminPage";

/**
 * /admin/customers + /admin/customers/[id] (owner: customers-screen-agent).
 * Guest rows (id: null) render a Guest badge and never link to a detail
 * page; registered rows link through the first (Name) cell.
 */
export class AdminCustomersPage {
  constructor(private readonly page: Page) {}

  /** Bounce through the middleware guard and land on the customers list. */
  async gotoAsOwner(): Promise<void> {
    const admin = new AdminPage(this.page);
    await admin.signInAsOwner("/admin/customers");
  }

  async expectHeading(): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name: "Customers" })).toBeVisible();
  }

  private customerRow(name: string) {
    return this.page.getByRole("row").filter({ hasText: name });
  }

  async expectCustomer(name: string, { guest }: { guest: boolean }): Promise<void> {
    const row = this.customerRow(name);
    await expect(row).toBeVisible();
    if (guest) {
      await expect(row.getByText("Guest", { exact: true })).toBeVisible();
    } else {
      await expect(row.getByText("Guest", { exact: true })).toHaveCount(0);
    }
  }

  /** Guest rows never link to a detail page (rowLink returns null). */
  async expectGuestRowNotLinked(name: string): Promise<void> {
    await expect(this.customerRow(name).getByRole("link")).toHaveCount(0);
  }

  /** Open a registered customer's detail page via the Name-cell link. */
  async openDetail(name: string, email: string): Promise<void> {
    await this.page.getByRole("link", { name, exact: true }).first().click();
    await expect(this.page).toHaveURL(/\/admin\/customers\/[^/]+$/);
    await expect(this.page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(this.page.getByText(email, { exact: true })).toBeVisible();
  }

  async expectDetailKpis(): Promise<void> {
    // Scoped to the KPI StatCard paragraphs: "Orders" also exists in the
    // sidebar nav link, so an unscoped text query would be ambiguous.
    const main = this.page.locator("main#main");
    for (const title of ["Orders", "Total spent", "Last order"]) {
      await expect(main.getByRole("paragraph").getByText(title, { exact: true })).toBeVisible();
    }
    await expect(main.getByText(/RWF/).first()).toBeVisible();
  }

  async expectPurchaseHistory(orderNumbers: string[]): Promise<void> {
    await expect(
      this.page.getByRole("heading", { level: 2, name: "Purchase history" }),
    ).toBeVisible();
    for (const number of orderNumbers) {
      await expect(this.page.getByText(number, { exact: true })).toBeVisible();
    }
  }
}