/**
 * Admin shared widgets — the single import surface for dashboard screens:
 *
 *   import { DataTable, StatCard, StatusBadge } from "@/components/admin";
 *
 * Owned by dashboard-agent. Screen agents consume, never edit. Shell pieces
 * (AdminSidebar, AdminTopBar, SidebarNav, MobileAdminNav, LogoutButton,
 * nav, icons) are also exported here for convenience.
 */
export * from "./AdminSidebar";
export * from "./AdminTopBar";
export * from "./ChartCard";
export * from "./DataTable";
export * from "./FilterBar";
export * from "./LogoutButton";
export * from "./MobileAdminNav";
export * from "./SidebarNav";
export * from "./StatCard";
export * from "./StatusBadge";
export * from "./icons";
export * from "./nav";