// @vitest-environment jsdom
/**
 * useCart hook / CartProvider (src/lib/hooks/useCart.tsx) — context wiring
 * only. The cart server actions are mocked: real action behaviour (DB writes,
 * stock capping, cookie handling) is covered by the integration suite.
 *
 * Covered:
 * - throws outside a provider (guard clause)
 * - provider renders the initial cart (badge count = Σ quantities)
 * - guest hydration: no initialCart → getCartAction fires on mount
 * - add/updateQty/remove call the right action and update state on ok
 * - action error surfaces on the hook and state is untouched
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActionResult, CartDTO } from "@/types/api";

// The hook imports the cart actions — swap them for spies.
vi.mock("@/actions/cart", () => ({
  addToCartAction: vi.fn(),
  getCartAction: vi.fn(),
  removeCartItemAction: vi.fn(),
  updateCartQtyAction: vi.fn(),
}));

import { addToCartAction, getCartAction, removeCartItemAction, updateCartQtyAction } from "@/actions/cart";
import { CartProvider, useCart } from "@/lib/hooks/useCart";

// vi.mock factory typing does not flow to the imported bindings — use
// vi.mocked for configuring return values (mockResolvedValue etc.).
const addToCartActionMock = vi.mocked(addToCartAction);
const getCartActionMock = vi.mocked(getCartAction);
const updateCartQtyActionMock = vi.mocked(updateCartQtyAction);
const removeCartItemActionMock = vi.mocked(removeCartItemAction);

// --- fixtures ---------------------------------------------------------------

function makeCart(id: string, quantities: number[]): CartDTO {
  return {
    id,
    items: quantities.map((qty, i) => ({
      id: `item-${i}`,
      quantity: qty,
      lineTotalCents: 1000 * qty,
      product: {
        id: `p-${i}`,
        slug: `p-${i}`,
        name: `Product ${i}`,
        description: "x",
        imageUrls: [],
        priceCents: 1000,
        currency: "RWF",
        stockQty: 99,
        lowStockThreshold: 5,
        isPublished: true,
        featured: false,
        category: { id: "cat-1", slug: "tools", name: "Tools" },
      },
    })),
    subtotalCents: 1000 * quantities.reduce((a, b) => a + b, 0),
    totalCents: 1000 * quantities.reduce((a, b) => a + b, 0),
    currency: "RWF",
  };
}

function Probe() {
  const { cart, itemCount, add, updateQty, remove, refresh, pending, error } = useCart();
  return (
    <div>
      <span data-testid="count">{itemCount}</span>
      <span data-testid="cart-id">{cart?.id ?? "none"}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <span data-testid="pending">{pending ? "pending" : "idle"}</span>
      <button onClick={() => void add("p-1", 2)}>add</button>
      <button onClick={() => void updateQty("p-1", 3)}>qty</button>
      <button onClick={() => void remove("p-1")}>remove</button>
      <button onClick={() => void refresh()}>refresh</button>
    </div>
  );
}

function renderWithCart(initialCart: CartDTO | null) {
  return render(
    <CartProvider initialCart={initialCart}>
      <Probe />
    </CartProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- tests --------------------------------------------------------------------

describe("useCart context", () => {
  it("throws outside a provider", () => {
    expect(() => render(<Probe />)).toThrow(/CartProvider/);
  });

  it("renders the initial cart and derives the badge count", () => {
    renderWithCart(makeCart("cart-a", [2, 3]));
    expect(screen.getByTestId("count")).toHaveTextContent("5");
    expect(screen.getByTestId("cart-id")).toHaveTextContent("cart-a");
    // initialCart present → no hydration fetch
    expect(getCartActionMock).not.toHaveBeenCalled();
  });

  it("hydrates from the server when no initial cart exists (guest first visit)", async () => {
    getCartActionMock.mockResolvedValue({ ok: true, data: makeCart("cart-g", [1]) } satisfies ActionResult<CartDTO>);

    renderWithCart(null);

    await waitFor(() => expect(getCartActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("1"));
    expect(screen.getByTestId("cart-id")).toHaveTextContent("cart-g");
  });

  it("add calls the action and updates state on success", async () => {
    const user = userEvent.setup();
    addToCartActionMock.mockResolvedValue({ ok: true, data: makeCart("cart-a", [2]) } satisfies ActionResult<CartDTO>);

    renderWithCart(makeCart("cart-a", [1]));
    await user.click(screen.getByRole("button", { name: "add" }));

    expect(addToCartActionMock).toHaveBeenCalledWith({ productId: "p-1", quantity: 2 });
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
    expect(screen.getByTestId("pending")).toHaveTextContent("idle");
  });

  it("updateQty and remove call their actions", async () => {
    const user = userEvent.setup();
    updateCartQtyActionMock.mockResolvedValue({ ok: true, data: makeCart("cart-a", [3]) } satisfies ActionResult<CartDTO>);
    removeCartItemActionMock.mockResolvedValue({ ok: true, data: makeCart("cart-a", []) } satisfies ActionResult<CartDTO>);

    renderWithCart(makeCart("cart-a", [1]));
    await user.click(screen.getByRole("button", { name: "qty" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("3"));

    await user.click(screen.getByRole("button", { name: "remove" }));
    await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("0"));
    expect(updateCartQtyActionMock).toHaveBeenCalledWith({ productId: "p-1", quantity: 3 });
    expect(removeCartItemActionMock).toHaveBeenCalledWith({ productId: "p-1" });
  });

  it("surfaces action errors without clobbering the current cart", async () => {
    const user = userEvent.setup();
    addToCartActionMock.mockResolvedValue({
      ok: false,
      error: { code: "OUT_OF_STOCK", message: "Out of stock" },
    } satisfies ActionResult<CartDTO>);

    renderWithCart(makeCart("cart-a", [1]));
    await user.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("Out of stock"));
    expect(screen.getByTestId("count")).toHaveTextContent("1"); // cart untouched
  });
});
