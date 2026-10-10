# Zubeli — Screen & Route Ownership Contract

*Last updated: 2026-10-05*

Every route in the app has exactly ONE owning agent. No two agents ever edit the same file. Agents consume shared components but never edit them (foundation owners do).

## Storefront (customers)

| Route | Screen | Owner |
|---|---|---|
| `/` | Home / landing | `homepage-agent` |
| `/products` | Catalog (list, search, filters, categories) | `catalog-agent` |
| `/products/[slug]` | Product detail | `product-page-agent` |
| `/cart` | Cart | `cart-agent` |
| `/checkout` | Checkout flow | `checkout-agent` |
| `/checkout/success` | Order confirmation | `checkout-agent` |
| `/login`, `/register` | Auth screens | `account-agent` |
| `/account` | Profile | `account-agent` |
| `/account/orders` | Order history | `account-agent` |
| `/account/orders/[id]` | Order detail | `account-agent` |

## Dashboard (owner/admin)

| Route | Screen | Owner |
|---|---|---|
| `/admin` | Overview (KPIs, charts) | `sales-agent` |
| `/admin/products` | Product list | `inventory-agent` |
| `/admin/products/new` | Create product | `inventory-agent` |
| `/admin/products/[id]/edit` | Edit product | `inventory-agent` |
| `/admin/categories` | Category list | `inventory-agent` |
| `/admin/categories/new` | Create category | `inventory-agent` |
| `/admin/categories/[id]/edit` | Edit category | `inventory-agent` |
| `/admin/stock` | Stock levels, restocking, low-stock alerts | `stock-agent` |
| `/admin/orders` | Orders list | `orders-screen-agent` |
| `/admin/orders/[id]` | Order detail + status updates | `orders-screen-agent` |
| `/admin/customers` | Customers list | `customers-screen-agent` |
| `/admin/customers/[id]` | Customer detail + purchase history | `customers-screen-agent` |
| `/admin/sales` | Sales reports, revenue | `sales-agent` |

## Shared foundations (owned, not edited by screen agents)

| Asset | Owner |
|---|---|
| `components/ui/*` design system (buttons, cards, forms, inputs) | `frontend-agent` |
| Storefront layout, header, footer, navigation | `frontend-agent` |
| Shared storefront hooks (`useCart`, `useProducts`, ...) | `frontend-agent` |
| Dashboard shell, sidebar, layout, auth guards | `dashboard-agent` |
| Shared dashboard widgets/tables | `dashboard-agent` |
| API routes, server actions, auth, business logic (`app/api/*`, `lib/*`, `actions/*`) | `backend-agent` |
| Prisma schema, migrations, seed (`prisma/*`) | `database-agent` |
| `types/*` shared TS types (API contract) | `backend-agent` |

## Rules

1. Screen agents edit ONLY files under their own routes.
2. Screen agents consume foundation components via imports; never modify them. File a report to the orchestrator if a component is missing.
3. `backend-agent` writes the API; screen agents call it through shared typed helpers only.
4. Any agent needing a new shared component asks the orchestrator, who dispatches the owner.
5. `docs/SCREENS.md` must be updated by `docs-writer` whenever a route is added, removed, or re-owned.
