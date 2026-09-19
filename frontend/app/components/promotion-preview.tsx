"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { parsePromotionPreview } from "@/lib/api/promotion-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
export function PromotionPreview({
  code,
  subtotalKobo,
}: {
  code: string;
  subtotalKobo: string;
}) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState<string>();
  const [error, setError] = useState<string>();
  useEffect(() => () => pending.current?.abort(), []);
  async function preview() {
    if (pending.current || !code.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    setDiscount(undefined);
    try {
      const normalized = code.trim().toUpperCase();
      const result = parsePromotionPreview(
        (
          await apiRequest<unknown>("/customers/promotions/preview", {
            method: "POST",
            csrf: true,
            signal: controller.signal,
            body: { code: normalized, subtotalKobo },
          })
        ).data,
      );
      if (
        result.code !== normalized ||
        BigInt(result.discountAmountKobo) <= BigInt(0) ||
        BigInt(result.discountAmountKobo) > BigInt(subtotalKobo)
      )
        throw new Error("Unexpected promotion preview");
      if (!controller.signal.aborted) setDiscount(result.discountAmountKobo);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof ApiError && failure.status === 409
            ? "This code is not eligible for the current subtotal or your account. Check the code or continue without it."
            : failure instanceof ApiError
              ? failure.message
              : "We could not check this code. Try checking it again before checkout.",
        );
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="promotion-preview">
      <button
        type="button"
        className="button secondary"
        disabled={busy || !code.trim()}
        onClick={() => void preview()}
      >
        {busy ? "Checking code…" : "Check promotion code"}
      </button>
      <Feedback message={error} />
      {discount && (
        <div className="notice" role="status">
          <p>
            Estimated discount: <strong>{formatKobo(discount)}</strong>
          </p>
          <p>
            This check does not reserve a discount. The final discount and total are
            confirmed when the order is created.
          </p>
        </div>
      )}
    </div>
  );
}
