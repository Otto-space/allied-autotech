"use client";
import Link from "next/link";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseInventory, type InventoryReservation } from "@/lib/api/inventory-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import {
  InventoryMovementForm,
  InventoryReservationForm,
  ReorderLevelForm,
} from "./inventory-change-forms";
import { InventoryHistory, InventoryReservations } from "./inventory-records";
export function StaffInventoryDetail({ inventoryId }: { inventoryId: string }) {
  const inventory = useResource(`/staff/inventory/${inventoryId}`, parseInventory);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [pending, setPending] = useState<MutationProposal | null>(null);
  const [reservation, setReservation] = useState<InventoryReservation | null>(null);
  const [revision, setRevision] = useState(0);
  const [formRevision, setFormRevision] = useState(0);
  const [message, setMessage] = useState<string>();
  const disabled = inventory.loading || !!inventory.error || !!proposal || !!pending;
  function review(value: MutationProposal) {
    if (disabled) return;
    setMessage(undefined);
    const wrapped: MutationProposal = {
      ...value,
      onUncertain: () => {
        value.onUncertain?.();
        if (value.retrySafely) setPending(wrapped);
      },
    };
    setProposal(wrapped);
  }
  function refresh() {
    inventory.refresh();
    setRevision((value) => value + 1);
  }
  return (
    <>
      <Link className="text-link" href="/admin/inventory">
        Back to parts inventory
      </Link>
      <h1>Manage inventory</h1>
      <Feedback message={inventory.error} />
      <Feedback message={message} tone="success" />
      <button
        className="button secondary"
        disabled={inventory.loading || !!proposal}
        onClick={refresh}
      >
        Refresh inventory record
      </button>
      {inventory.loading && <p role="status">Checking stock balances…</p>}
      {pending && (
        <div className="notice">
          <p>
            A stock change is still unconfirmed. Review the current balances and history
            before proceeding. Other changes remain paused.
          </p>
          {pending.retrySafely && (
            <button
              className="button secondary"
              disabled={!!proposal || inventory.loading}
              onClick={() => setProposal(pending)}
            >
              Resolve pending stock change
            </button>
          )}
          <a className="text-link" href="#inventory-history">
            Review stock history
          </a>
          {!pending.retrySafely && (
            <p>
              Refresh and review this record before leaving the page. This request does
              not support an automatic retry.
            </p>
          )}
        </div>
      )}
      {inventory.data && (
        <>
          <section className="detail-section">
            <h2>{inventory.data.product.name}</h2>
            <p>
              {inventory.data.product.sku} · {inventory.data.branch.name}
            </p>
            <dl className="totals">
              <dt>On hand</dt>
              <dd>{inventory.data.quantity}</dd>
              <dt>Reserved</dt>
              <dd>{inventory.data.reserved}</dd>
              <dt>Available</dt>
              <dd>{inventory.data.available}</dd>
              <dt>Reorder level</dt>
              <dd>{inventory.data.reorderLevel}</dd>
              <dt>Catalogue price</dt>
              <dd>{formatKobo(inventory.data.product.priceKobo)}</dd>
              <dt>Last updated</dt>
              <dd>{formatBusinessDate(inventory.data.updatedAt)}</dd>
            </dl>
            {(!inventory.data.branch.isActive ||
              !inventory.data.product.isActive ||
              !inventory.data.product.category.isActive) && (
              <Feedback
                message="This branch, product or category is inactive. The server may restrict new reservations and sales."
                tone="info"
              />
            )}
          </section>
          <InventoryMovementForm
            key={`movement-${formRevision}-${reservation?.id ?? "unreserved"}`}
            inventory={inventory.data}
            disabled={disabled}
            onReview={review}
            reservation={reservation}
            onClearReservation={() => setReservation(null)}
          />
          <InventoryReservationForm
            key={`reserve-${formRevision}`}
            inventory={inventory.data}
            disabled={disabled}
            onReview={review}
          />
          <ReorderLevelForm
            key={`reorder-${inventory.data.version}`}
            inventory={inventory.data}
            disabled={disabled}
            onReview={review}
          />
          <InventoryReservations
            key={`reservations-${revision}`}
            inventoryId={inventoryId}
            disabled={disabled}
            onReview={review}
            onConsume={(value) => {
              setReservation(value);
              requestAnimationFrame(() =>
                document
                  .getElementById("inventory-movement")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" }),
              );
            }}
          />
          <InventoryHistory key={`history-${revision}`} inventoryId={inventoryId} />
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            refresh();
          }}
          onSuccess={() => {
            setPending(null);
            setFormRevision((value) => value + 1);
            setReservation(null);
            setMessage(
              "Inventory change recorded. Review the refreshed balances and history.",
            );
          }}
        />
      )}
    </>
  );
}
