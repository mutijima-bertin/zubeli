import Link from "next/link";
import { forwardRef } from "react";
import { Spinner } from "./Spinner";
import { cx } from "./utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900",
  secondary: "bg-ink-light text-white hover:bg-ink active:bg-ink-dark",
  outline: "border border-stone-300 bg-white text-ink hover:bg-stone-50 active:bg-stone-100",
  ghost: "text-ink hover:bg-stone-100 active:bg-stone-200",
  danger: "bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-500",
};

// Touch targets: sm=40px, md=44px, lg=48px (ui-design-principles).
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-10 gap-1.5 px-3 text-sm",
  md: "h-11 gap-2 px-4 text-sm",
  lg: "h-12 gap-2.5 px-6 text-base",
};

type BaseButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows an inline spinner and blocks interaction while true. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
};

/**
 * Button is the single CTA primitive. Pass `href` to render an anchor
 * (Next Link) — link and button share the same visual language.
 */
export type ButtonProps = BaseButtonProps &
  (
    | ({ href?: undefined } & React.ButtonHTMLAttributes<HTMLButtonElement>)
    | ({ href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>)
  );

const baseClasses =
  "inline-flex select-none items-center justify-center rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60";

export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(
    { variant = "primary", size = "md", loading = false, fullWidth = false, className, children, ...rest },
    ref,
  ) {
    const classes = cx(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && "w-full",
      className,
    );

    if ("href" in rest && rest.href !== undefined) {
      const { href, ...anchorRest } = rest as { href: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>;
      return (
        <Link ref={ref as React.Ref<HTMLAnchorElement>} href={href} className={classes} {...anchorRest}>
          {loading && <Spinner size="sm" />}
          {children}
        </Link>
      );
    }

    const buttonProps = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
        {...buttonProps}
        disabled={loading || buttonProps.disabled}
        aria-busy={loading || undefined}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  },
);