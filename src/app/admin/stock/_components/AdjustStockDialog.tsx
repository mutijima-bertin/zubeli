"use client";
import { useState, useTransition, type FormEvent } from "react";
import { adjustStockAction } from "@/actions/admin/stock";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import type { ActionResult, ProductDTO } from "@/types/api";

/** ZodError fieldErrors shape (src/lib/errors.ts toActionResult). */
type FieldErrors = Record<string, string[] | undefined>;

function getFieldErrors(details: unknown): FieldErrors {
  if (!details || typeof details !== "object") return {};
  const fieldErrors = (details as { fieldErrors?: unknown }).fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object") return {};
  return fieldErrors as FieldErrors;
}

const DIRECTION_OPTIONS: { value: "IN" | "OUT"; label: string }[] = [
  { value: "IN", label: "Stock in (add units)" },
  { value: "OUT", label: "Stock out (remove units)" },
];

/**
 * Reason options mirror stockAdjustSchema: RESTOCK (+ direction IN) or
 * ADJUSTMENT. Write-offs (OUT) are always ADJUSTMENT — "restock out" is
 * not a real operation, so the option list narrows with the direction.
 */
const REASON_OPTIONS: Record<
  "IN" | "OUT",
  { value: "RESTOCK" | "ADJUSTMENT"; label: string }[]
> = {
  IN: [
    { value: "RESTOCK", label: "Restock — new delivery received" },
    { value: "ADJUSTMENT", label: "Adjustment — count correction" },
  ],
  OUT: [{ value: "ADJUSTMENT", label: "Adjustment — write-off / damage" }],
};

/**
 * Inline stock adjustment dialog. Mirrors stockAdjustSchema (quantity 1..10000,
 * direction IN|OUT, reason RESTOCK|ADJUSTMENT, optional note ≤500); the server
 * action stays authoritative (below-zero writes are rejected there too).
 */
export function AdjustStockDialog({
  product,
  onClose,
  onAdjusted,
}: {
  product: ProductDTO;
  onClose: () => void;
  onAdjusted: (updated: ProductDTO) => void;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [reason, setReason] = useState<"RESTOCK" | "ADJUSTMENT">("RESTOCK");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ActionResult<ProductDTO> | null>(null);

  const parsedQty = Number(quantity);
  const qtyInvalid = !Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 10000;
  const wouldGoNegative =
    direction === "OUT" && Number.isInteger(parsedQty) && parsedQty > product.stockQty;
  const projectedStock =
    direction === "IN" ? product.stockQty + parsedQty : product.stockQty - parsedQty;

  const error = result && !result.ok ? result.error : null;
  const fieldErrors = getFieldErrors(error?.details);
  const pageError = error && error.code !== "VALIDATION" ? error : null;

  function handleDirectionChange(next: "IN" | "OUT") {
    setDirection(next);
    setReason(next === "OUT" ? "ADJUSTMENT" : "RESTOCK");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (qtyInvalid || wouldGoNegative || isPending) return;
    setResult(null);
    startTransition(async () => {
      const res = await adjustStockAction({
        productId: product.id,
        quantity: parsedQty,
        direction,
        reason,
        note: note.trim() || undefined,
      });
      if (!res.ok) {
        setResult(res);
        return;
      }
      toast({
        tone: "success",
        title: "Stock updated",
        message: `${product.name} now has ${res.data.stockQty} in stock.`,
      });
      onAdjusted(res.data);
    });
  }

  return (
    <Dialog open title={`Adjust stock — ${product.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4 px-5 py-4">
        <p className="text-sm text-stone-600">
          Current stock:{" "}
          <span className="font-semibold text-ink">{product.stockQty}</span>
          {product.lowStockThreshold > 0 && (
            <span className="text-stone-500"> · low at ≤ {product.lowStockThreshold}</span>
          )}
        </p>

        {error && error.code === "VALIDATION" && (
          <Alert tone="danger" title="Adjustment rejected">
            {error.message}
          </Alert>
        )}
        {pageError && (
          <Alert tone="danger" title="Could not adjust stock">
            {pageError.message}
          </Alert>
        )}

        <FormField label="Action" required error={fieldErrors.direction}>
          <Select
            value={direction}
            onChange={(event) => handleDirectionChange(event.target.value as "IN" | "OUT")}
          >
            {DIRECTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Reason" required error={fieldErrors.reason}>
          <Select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as "RESTOCK" | "ADJUSTMENT")
            }
          >
            {REASON_OPTIONS[direction].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Quantity"
          required
          hint={
            direction === "OUT"
              ? `Write-off — remove up to ${product.stockQty} to keep stock non-negative.`
              : "Whole units, 1 to 10,000."
          }
          error={fieldErrors.quantity}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>

        <FormField
          label="Note"
          hint="Optional — why this movement happened."
          error={fieldErrors.note}
        >
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="e.g. Damaged in store, counted during stocktake"
          />
        </FormField>

        {wouldGoNegative ? (
          <Alert tone="warning" title="Cannot go below zero">
            Removing {parsedQty} unit{parsedQty === 1 ? "" : "s"} would take this product
            below zero — reduce the amount or switch to stock in.
          </Alert>
        ) : (
          Number.isInteger(parsedQty) &&
          parsedQty >= 1 && (
            <p className="text-sm text-stone-600">
              Stock after: <span className="font-semibold text-ink">{projectedStock}</span>
            </p>
          )
        )}

        <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={isPending}
            disabled={qtyInvalid || wouldGoNegative}
          >
            {isPending ? "Saving…" : "Save adjustment"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}