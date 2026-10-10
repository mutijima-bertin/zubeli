import { expect, type Locator, type Page } from "@playwright/test";

export type ShippingValues = {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city?: string;
};

/** MVP payment options (prisma PaymentMethod enum, UI PAYMENT_OPTIONS). */
export type PaymentMethodValue = "COD_CASH" | "COD_MOBILE_MONEY" | "BANK_TRANSFER";

/**
 * Checkout /checkout (owner: checkout-agent). Guest-friendly form; the
 * createOrderAction Flight action is only ever driven through the form.
 *
 * CONFIGURABLE OFFER: which payment methods this screen renders is decided by
 * the `PAYMENT_METHODS` allowlist (src/lib/site.ts → visiblePaymentOptions),
 * so a spec must NEVER assume a method is present. Use
 * `availablePaymentMethods()` (reads the rendered radios — the customer's view
 * is the only source of truth) and skip method-specific journeys honestly.
 */
export class CheckoutPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/checkout");
  }

  /** Empty cart → the page still renders the empty state, never a dead form. */
  async expectEmptyCart(): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    await expect(this.page.getByRole("link", { name: "Browse tools" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Place order" })).toHaveCount(0);
  }

  async fillShipping(values: ShippingValues): Promise<void> {
    await this.page.getByLabel("Full name").fill(values.name);
    await this.page.getByLabel("Phone number").fill(values.phone);
    if (values.email) await this.page.getByLabel("Email (optional)").fill(values.email);
    await this.page.getByLabel("Delivery address").fill(values.address);
    if (values.city) await this.page.getByLabel("City (optional)").fill(values.city);
  }

  /**
   * Select a pay-on-delivery radio by its enum value. The radio's accessible
   * name is the full option label (title + description), so matching by the
   * input's name/value attributes is unambiguous.
   */
  async selectPayment(method: PaymentMethodValue): Promise<void> {
    await this.page.locator(`input[name="paymentMethod"][value="${method}"]`).check();
  }

  // --- the configurable offer (PAYMENT_METHODS) ------------------------------

  /** The rendered payment radios (one per offered method). */
  paymentMethodRadios(): Locator {
    return this.page.locator('input[name="paymentMethod"]');
  }

  /**
   * The methods this storefront ACTUALLY offers right now, in render order.
   * Read from the DOM on purpose: the allowlist lives in server env, and what
   * the customer can pick is what the page rendered.
   */
  async availablePaymentMethods(): Promise<PaymentMethodValue[]> {
    await expect(this.paymentMethodRadios().first()).toBeVisible();
    const values = await this.paymentMethodRadios().evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLInputElement).value),
    );
    return values as PaymentMethodValue[];
  }

  /**
   * The payment step is never dead: at least one method is offered and exactly
   * one is pre-selected, so the step is always completable (the picker's
   * documented fallback). Asserted rather than assumed.
   */
  async expectCompletablePaymentStep(): Promise<void> {
    await expect(this.paymentMethodRadios().first()).toBeVisible();
    await expect(this.page.locator('input[name="paymentMethod"]:checked')).toHaveCount(1);
  }

  /**
   * Honest reason for `test.skip()` when a method-specific journey cannot run —
   * names the method AND what the storefront offered instead, so a skip in CI
   * is never mistaken for a pass.
   */
  skipReasonFor(method: PaymentMethodValue, offered: PaymentMethodValue[]): string {
    const list = offered.length > 0 ? offered.join(", ") : "nothing (unrenderable allowlist)";
    return `PAYMENT_METHODS excludes ${method} — storefront offers: ${list}`;
  }

  /** BANK_TRANSFER reveals the required reference input + bank details. */
  async expectReferenceInputVisible(): Promise<void> {
    await expect(this.page.getByLabel("Bank transfer reference")).toBeVisible();
  }

  async expectMoMoCopy(): Promise<void> {
    await expect(this.page.getByText(/Pay at the door via MTN MoMo or Airtel Money/)).toBeVisible();
  }

  async fillBankReference(reference: string): Promise<void> {
    await this.page.getByLabel("Bank transfer reference").fill(reference);
  }

  async clickPlaceOrder(): Promise<void> {
    await this.page.getByRole("button", { name: "Place order" }).click();
    await expect(this.page.getByRole("button", { name: "Placing your order…" })).toBeHidden();
  }

  /** Submit and wait for the confirmation redirect. */
  async placeOrder(): Promise<void> {
    await this.clickPlaceOrder();
    await this.page.waitForURL(/\/checkout\/success\?order=/);
  }

  /** Client-side validation error (e.g. missing bank reference). */
  async expectFieldError(message: string): Promise<void> {
    await expect(this.page.getByText(message, { exact: true })).toBeVisible();
  }

  /** Order must NOT have been placed — we're still on /checkout. */
  async expectNoOrderPlaced(): Promise<void> {
    await expect(this.page).toHaveURL(/\/checkout$/);
  }
}