/**
 * Inline icon set for the design system + storefront (stroke-based, 24px).
 * Every icon is decorative by default (`aria-hidden`) — pair with a visible
 * label or an `aria-label` on the interactive element that hosts it.
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

export function IconCart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 4h2l2.4 12.4a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17.5" cy="19" r="1.4" />
    </Icon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.8-3.8" />
    </Icon>
  );
}

export function IconMenu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  );
}

export function IconX(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

export function IconUser(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconMinus(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14" />
    </Icon>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 12h16m0 0-6-6m6 6-6 6" />
    </Icon>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Icon>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8h.01M12 11v5" />
    </Icon>
  );
}

export function IconAlert(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.6 19.5h18.8L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 16.5h.01" />
    </Icon>
  );
}

export function IconWarning(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" />
      <path d="M12 15.5h.01" />
    </Icon>
  );
}

export function IconBox(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 3.5 8v8L12 21l8.5-5V8L12 3Z" />
      <path d="M3.5 8 12 13l8.5-5M12 13v8" />
    </Icon>
  );
}

export function IconPhone(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 4h3l1.5 4.5-2 1.5a12.5 12.5 0 0 0 6 6l1.5-2L20 15.5v3a1.5 1.5 0 0 1-1.7 1.5A16.5 16.5 0 0 1 4 6.7 1.5 1.5 0 0 1 5.5 4Z" />
    </Icon>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Icon>
  );
}

export function IconMapPin(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6.2 7l.7 11.2a2 2 0 0 0 2 1.8h6.2a2 2 0 0 0 2-1.8L17.8 7" />
    </Icon>
  );
}

export function IconShieldCheck(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 4.5 6v5.5c0 4.5 3.2 7.6 7.5 9.5 4.3-1.9 7.5-5 7.5-9.5V6L12 3Z" />
      <path d="m8.5 12 2.3 2.3 4.7-5" />
    </Icon>
  );
}