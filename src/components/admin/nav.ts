import type { ComponentType, SVGProps } from "react";
import { IconChartBar, IconInventory, IconLayoutGrid, IconPackage, IconReceipt, IconUsers } from "./icons";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * The admin navigation contract — single source for the desktop sidebar and
 * the mobile drawer. Order = display order. Every href is owned by a screen
 * agent (docs/SCREENS.md); routes land later in this milestone.
 */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Overview", href: "/admin", icon: IconLayoutGrid },
  { label: "Products", href: "/admin/products", icon: IconPackage },
  { label: "Stock", href: "/admin/stock", icon: IconInventory },
  { label: "Orders", href: "/admin/orders", icon: IconReceipt },
  { label: "Customers", href: "/admin/customers", icon: IconUsers },
  { label: "Sales", href: "/admin/sales", icon: IconChartBar },
];