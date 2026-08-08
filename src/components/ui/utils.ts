/**
 * Shared design-system utilities.
 * `cx` is a dependency-free classname joiner (clsx is deliberately not a
 * dependency — package.json is shared-file governance, no new deps).
 */

export type ClassValue = string | number | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}