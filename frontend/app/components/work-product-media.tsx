"use client";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { parseAdminProduct } from "@/lib/admin/product-catalogue";
import { ProductExtrasEditor } from "./product-extras-editor";
import { Feedback } from "./feedback";

export function WorkProductMedia({
  id,
  owner,
  onClose,
  onUpdated,
}: {
  id: string;
  owner: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const marker = `work-product-media-pending:${owner}:${id}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return (
        typeof window !== "undefined" && sessionStorage.getItem(marker) === "pending"
      );
    } catch {
      return false;
    }
  });
  const [epoch, setEpoch] = useState(0),
    [recovering, setRecovering] = useState(false),
    [error, setError] = useState("");
  function pending(value: boolean) {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, "pending");
      else sessionStorage.removeItem(marker);
    } catch {
      /* Keep in-memory protection. */
    }
  }
  return (
    <div className="product-media-workspace" id="product-media-workspace">
      {uncertain && (
        <div className="product-media-recovery">
          <p className="notice" role="status">
            The previous product change could not be confirmed. Reload its saved records
            before making another change.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={recovering}
            onClick={async () => {
              setRecovering(true);
              setError("");
              try {
                const record = parseAdminProduct(
                  (await apiRequest(`/admin/catalog/products/${id}`)).data,
                );
                if (record.id !== id) throw new Error("Unexpected product");
                document
                  .querySelectorAll("#product-media-workspace form")
                  .forEach((form) =>
                    form.dispatchEvent(new Event("reset", { bubbles: true })),
                  );
                pending(false);
                setEpoch((v) => v + 1);
                onUpdated();
              } catch {
                setError(
                  "The saved product records could not be loaded. Your changes remain locked.",
                );
              } finally {
                setRecovering(false);
              }
            }}
          >
            {recovering
              ? "Loading saved records…"
              : "Discard draft and reload saved product records"}
          </button>
          <Feedback message={error} />
        </div>
      )}
      <ProductExtrasEditor
        key={`${id}:${epoch}`}
        productId={id}
        sourcePath={`/admin/catalog/products/${id}`}
        uncertain={uncertain}
        onUncertain={() => pending(true)}
        onPendingChange={pending}
        onUpdated={onUpdated}
        onClose={onClose}
      />
    </div>
  );
}
