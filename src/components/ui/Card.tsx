import { cx } from "./utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("rounded-xl border border-stone-200 bg-white shadow-card", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  title,
  description,
  children,
}: {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-5 py-4", className)}>
      {(title || description) && (
        <div className="min-w-0">
          {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cx("px-5 py-4", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cx("border-t border-stone-100 px-5 py-4", className)}>{children}</div>;
}