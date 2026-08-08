/**
 * Admin-side icon set (stroke-based, 24px, mirrors the design-system style).
 * Owned by dashboard-agent — kept separate from `components/ui/icons.tsx`
 * so the storefront foundation stays frozen. Every icon is decorative by
 * default (`aria-hidden`) — pair with a visible label.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** 2×2 grid — the admin Overview entry. */
export function IconLayoutGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

/** Parcel / box — Products. */
export function IconPackage(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 3.5 8v8L12 21l8.5-5V8L12 3Z" />
      <path d="M3.5 8 12 13l8.5-5M12 13v8" />
      <path d="m7.5 10.5 4.5 2.5 4.5-2.5" />
    </Icon>
  );
}

/** Three stacked crates — Stock levels / inventory. */
export function IconInventory(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6.5v5L12 15l7-3.5v-5L12 3Z" />
      <path d="M5 11.5 12 15l7-3.5" />
      <path d="M5 16.5 12 20l7-3.5" />
    </Icon>
  );
}

/** Receipt — Orders. */
export function IconReceipt(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3Z" />
      <path d="M9 8h6M9 12h6" />
    </Icon>
  );
}

/** Two people — Customers. */
export function IconUsers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Icon>
  );
}

/** Bars + baseline — Sales / revenue. */
export function IconChartBar(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 20V10M10 20V4.5M15.5 20v-6M21 20H3" />
    </Icon>
  );
}

/** Shop front — "View storefront" link. */
export function IconStore(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3.5" />
      <path d="M3.5 9.5h17l-1.4 8a2 2 0 0 1-2 1.5H6.9a2 2 0 0 1-2-1.5l-1.4-8Z" />
      <path d="M9.5 19v-4.5a2.5 2.5 0 0 1 5 0V19" />
    </Icon>
  );
}

/** Chevron up — ascending sort caret (mirrors the design-system chevron). */
export function IconChevronUp(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 15 6-6 6 6" />
    </Icon>
  );
}

/** Chevron down — descending sort caret (mirrors the design-system chevron). */
export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

/** Chevrons up/down — "sortable, not sorted yet" affordance. */
export function IconSort(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </Icon>
  );
}