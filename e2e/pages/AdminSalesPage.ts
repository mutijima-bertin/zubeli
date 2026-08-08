import { expect, type Page } from "@playwright/test";
import { AdminPage } from "./AdminPage";

/**
 * /admin (overview) + /admin/sales (owner: sales-agent).
 * Both render KPI StatCards, the 12-month revenue chart and top-product
 * tables. Sales is URL-driven (?from&to, default current month) — the
 * period form pushes the query string and the server page re-fetches.
 */
export class AdminSalesPage {
  constructor(private readonly page: Page) {}

  /** Bounce through the middleware guard onto the given sales route. */
  async gotoAsOwner(path = "/admin/sales"): Promise<void> {
    const admin = new AdminPage(this.page);
    await admin.signInAsOwner(path);
  }

  async expectHeading(name: string): Promise<void> {
    await expect(this.page.getByRole("heading", { level: 1, name })).toBeVisible();
  }

  async expectKpi(title: string, money = false): Promise<void> {
    // KPI StatCard titles render as <p>; the sales report tables reuse the
    // same words ("Revenue" column header), so scope to paragraphs only.
    const main = this.page.locator("main#main");
    const card = main.getByRole("paragraph").getByText(title, { exact: true });
    await expect(card).toBeVisible();
    if (money) {
      await expect(main.getByText(/RWF/).first()).toBeVisible();
    }
  }

  async expectChart(): Promise<void> {
    await expect(
      this.page.getByText("Revenue by month", { exact: true }),
    ).toBeVisible();
  }

  /** The overview's Recent orders block shows at least one order number. */
  async expectRecentOrders(numberRe: RegExp): Promise<void> {
    await expect(this.page.getByText("Recent orders", { exact: true })).toBeVisible();
    await expect(this.page.getByText(numberRe).first()).toBeVisible();
  }

  /** Top-products table renders at least one RWF-ranked row. */
  async expectTopProducts(): Promise<void> {
    const table = this.page.locator('section[aria-label="Top products by revenue"]');
    await expect(table).toBeVisible();
    await expect(table.getByText(/RWF/).first()).toBeVisible();
  }

  /** Drive the period form: fill From/To and Apply, then await the URL. */
  async applyPeriod(from: string, to: string): Promise<void> {
    // exact: the bare substrings would also match aria-labels like
    // "Top products by revenue" and "Open Next.js Dev Tools".
    await this.page.getByLabel("From", { exact: true }).fill(from);
    await this.page.getByLabel("To", { exact: true }).fill(to);
    await this.page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(this.page).toHaveURL(/[\?&]from=.*[\?&]to=/);
  }

  /** FilterBar period summary echoes the selected range (en-GB dates). */
  async expectPeriodSummary(fromText: string, toText: string): Promise<void> {
    await expect(
      this.page.getByText(`${fromText} — ${toText}`, { exact: true }),
    ).toBeVisible();
  }
}