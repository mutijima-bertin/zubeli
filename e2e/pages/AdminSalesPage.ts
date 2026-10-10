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

  /**
   * Drive the period form: fill From/To and Apply, then await the URL.
   *
   * The URL assertion is the contract: the applied period must reach the query
   * string, not merely any from/to pair.
   *
   * Hydration race (why this retries instead of just filling once):
   * PeriodFilterForm is a client component with CONTROLLED inputs. A `fill`
   * that lands before React hydrates changes the DOM value without committing
   * state, and hydration then adopts that DOM value as the controlled value —
   * so `Apply` submits the period already in the URL (the handler early-returns
   * when state equals the props) and the query string never changes. Retrying
   * the whole cycle recovers as soon as React is live. Each attempt clears the
   * field first so the fill always carries a delta (React's value tracker
   * suppresses a change event with no delta). The asserted URL values are
   * unchanged by this, and there are no sleeps.
   */
  async applyPeriod(from: string, to: string): Promise<void> {
    // exact: the bare substrings would also match aria-labels like
    // "Top products by revenue" and "Open Next.js Dev Tools".
    const fromInput = this.page.getByLabel("From", { exact: true });
    const toInput = this.page.getByLabel("To", { exact: true });
    const apply = this.page.getByRole("button", { name: "Apply", exact: true });

    await expect(fromInput).toBeVisible();

    await expect(async () => {
      await fromInput.fill("");
      await fromInput.fill(from);
      await toInput.fill("");
      await toInput.fill(to);
      // Both controlled values are committed before Apply is clicked.
      await expect(fromInput).toHaveValue(from);
      await expect(toInput).toHaveValue(to);
      await apply.click();
      await expect(this.page).toHaveURL(
        (url) => url.searchParams.get("from") === from && url.searchParams.get("to") === to,
      );
    }).toPass({ timeout: 15_000 });
  }

  /** FilterBar period summary echoes the selected range (en-GB dates). */
  async expectPeriodSummary(fromText: string, toText: string): Promise<void> {
    await expect(
      this.page.getByText(`${fromText} — ${toText}`, { exact: true }),
    ).toBeVisible();
  }
}