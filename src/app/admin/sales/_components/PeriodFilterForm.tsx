"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui";
import { businessToday } from "@/lib/time";

/**
 * Today in business time (Africa/Kigali) as "YYYY-MM-DD" — the shape
 * `<input type="date">` needs. Never `new Date()` local parts: the server and
 * the owner's browser can sit in different zones, and the picker's `max` must
 * match the day the report counts.
 */
function todayInputValue(): string {
  const { y, m, d } = businessToday();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Sales period filter (sales-agent). Two date inputs + Apply. The query
 * string is the single source of truth (mirrors the catalog pattern): on
 * apply we `router.push` the new period and the server page re-fetches
 * getPeriodReportAction. Invalid ranges get inline feedback instead of a
 * pointless navigation.
 */
export function PeriodFilterForm({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);
  const [error, setError] = useState<string | null>(null);
  const max = todayInputValue();

  function applyPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromValue || !toValue) {
      setError("Choose both a start and an end date.");
      return;
    }
    if (fromValue > toValue) {
      setError("The start date must be on or before the end date.");
      return;
    }
    if (fromValue === from && toValue === to) return;
    setError(null);
    const params = new URLSearchParams({ from: fromValue, to: toValue });
    startTransition(() => {
      router.push(`/admin/sales?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <form onSubmit={applyPeriod} className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="report-from">From</Label>
        <Input
          id="report-from"
          type="date"
          value={fromValue}
          max={max}
          onChange={(event) => setFromValue(event.target.value)}
          className="w-40 sm:w-44"
        />
      </div>
      <div>
        <Label htmlFor="report-to">To</Label>
        <Input
          id="report-to"
          type="date"
          value={toValue}
          max={max}
          onChange={(event) => setToValue(event.target.value)}
          className="w-40 sm:w-44"
        />
      </div>
      <Button type="submit" size="sm" loading={pending}>
        Apply
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm font-medium text-danger-600">
          {error}
        </p>
      )}
    </form>
  );
}