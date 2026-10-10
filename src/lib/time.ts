/**
 * Business timezone — the single source of calendar truth for zubeli.
 *
 * The shop trades in Rwanda: Africa/Kigali is UTC+2 all year (no DST). The
 * production runtime is UTC (Vercel serverless) and development machines may be
 * in ANY zone, so server-local accessors (`getFullYear()`, `getMonth()`,
 * `getDate()`) are BANNED here — every calendar question is answered from
 * `Intl.DateTimeFormat#formatToParts` pinned to `BUSINESS_TIME_ZONE`. All
 * stored timestamps stay UTC instants; only their business-calendar projection
 * changes.
 *
 * Consumers: dashboard revenue/period bucketing (src/lib/db/sales.ts) and every
 * customer- and owner-visible date render (src/lib/format.ts).
 */
export const BUSINESS_TIME_ZONE = 'Africa/Kigali';

/** Wall-clock parts of an instant in the business timezone. */
type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const PARTS_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(instant: Date): ZonedParts {
  const parts: Record<string, number> = {};
  for (const part of PARTS_FORMAT.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

/** Business-zone offset (ms) in effect at `instant`. */
function zoneOffsetMs(instant: Date): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/** The UTC instant matching a business-timezone wall clock (two-pass, DST-safe). */
function businessInstant(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): Date {
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);
  const firstPass = new Date(wallAsUtc - zoneOffsetMs(new Date(wallAsUtc)));
  return new Date(wallAsUtc - zoneOffsetMs(firstPass));
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 + 1 };
}

/** 00:00:00.000 business time on the 1st of the given month. */
function monthStart(year: number, month: number): Date {
  return businessInstant(year, month, 1);
}

/** Last millisecond of the given month, business time (inclusive `to` bound). */
function monthEnd(year: number, month: number): Date {
  const next = shiftMonth(year, month, 1);
  return new Date(monthStart(next.year, next.month).getTime() - 1);
}

function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

/** The current instant — the "now" every other helper interprets in business time. */
export function businessNow(): Date {
  return new Date();
}

/** Calendar month of an instant in business time, e.g. '2026-08'. */
export function businessMonthKey(d: Date): string {
  const p = zonedParts(d);
  return monthKeyOf(p.year, p.month);
}

/** Same as businessMonthKey, accepting an ISO string. */
export function businessMonthKeyFor(iso: string | Date): string {
  return businessMonthKey(toDate(iso));
}

/**
 * Inclusive range of the business month `monthsBack` months before now
 * (default: the current business month). `to` is the last millisecond of the
 * CURRENT month. `now` is injectable so callers can snapshot one instant for a
 * whole computation.
 */
export function businessMonthRange(monthsBack = 0, now: Date = businessNow()): { from: Date; to: Date } {
  const p = zonedParts(now);
  const back = Math.max(0, Math.trunc(monthsBack));
  const start = shiftMonth(p.year, p.month, -back);
  return { from: monthStart(start.year, start.month), to: monthEnd(p.year, p.month) };
}

/** Today in business time, `m` 1-based. */
export function businessToday(): { y: number; m: number; d: number } {
  const p = zonedParts(businessNow());
  return { y: p.year, m: p.month, d: p.day };
}

/** Today in business time, midnight → last millisecond (inclusive `to`). */
export function businessTodayBounds(): { from: Date; to: Date } {
  const p = zonedParts(businessNow());
  return {
    from: businessInstant(p.year, p.month, p.day),
    to: businessInstant(p.year, p.month, p.day, 23, 59, 59, 999),
  };
}