"use client";

import { useEffect, useId, useRef, useState } from "react";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { parseOrder, parseOrders } from "@/lib/api/commerce-schemas";
import type { CustomerOrder } from "@/lib/api/order-payment";
import { purchaseRequest, subscribePurchaseAccess } from "@/lib/purchase/client";
import {
  reusablePurchaseSelections,
  type PurchaseSelection,
} from "@/lib/purchase/suitability";
import {
  fitmentLabels,
  fitmentQualifierKeys,
  parseFitmentModel,
  type FitmentOption,
} from "@/lib/parts-fitment";
import { useResource } from "@/lib/api/use-resource";
import { purchaseVehicleSelectionSchema } from "@/lib/api/purchase-review-schema";
import { FitmentCataloguePicker } from "./fitment-catalogue-picker";
import { Feedback } from "./feedback";
import { formatBusinessDate } from "@/lib/format/date";
import styles from "./purchase-suitability.module.css";

type Draft = {
  vehicle: boolean;
  modelId: string;
  makeId: string;
  year: string;
  qualifiers: Record<string, string>;
  make?: FitmentOption;
  model?: FitmentOption;
};
function draft(selection?: PurchaseSelection | null): Draft {
  return {
    vehicle: !!selection,
    modelId: selection?.vehicleModelId ?? "",
    makeId: selection?.vehicleMakeId ?? "",
    year: selection ? String(selection.year) : "",
    qualifiers: Object.fromEntries(
      fitmentQualifierKeys.map((key) => [key, selection?.[key] ?? ""]),
    ),
  };
}
function VehicleFields({
  value,
  onChange,
  id,
  disabled,
}: {
  value: Draft;
  onChange: (next: Draft) => void;
  id: string;
  disabled: boolean;
}) {
  const model = useResource(
    value.modelId && !value.model ? `/public/fitment/models/${value.modelId}` : null,
    parseFitmentModel,
  );
  return (
    <div className={styles.fields}>
      <div className="field">
        <label htmlFor={`${id}-make`}>Make</label>
        <span id={`${id}-make-hint`} className={styles.srOnly}>
          Search and select a vehicle make.
        </span>
        <FitmentCataloguePicker
          id={`${id}-make`}
          kind="make"
          value={value.makeId || model.data?.make.id || ""}
          selected={value.make ?? model.data?.make}
          disabled={disabled}
          onChange={(make) =>
            onChange({ ...draft(), vehicle: true, make, makeId: make?.id ?? "" })
          }
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-model`}>Model</label>
        <span id={`${id}-model-hint`} className={styles.srOnly}>
          Choose a make, then search and select a model.
        </span>
        <FitmentCataloguePicker
          id={`${id}-model`}
          kind="model"
          makeId={value.makeId || model.data?.make.id}
          value={value.modelId}
          selected={value.model ?? model.data}
          disabled={disabled}
          onChange={(next) =>
            onChange({
              ...value,
              model: next,
              modelId: next?.id ?? "",
              year: "",
              qualifiers: {},
            })
          }
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-year`}>Year</label>
        <input
          id={`${id}-year`}
          inputMode="numeric"
          type="number"
          min={value.model?.yearFrom ?? model.data?.yearFrom ?? 1886}
          max={value.model?.yearTo ?? model.data?.yearTo ?? 2200}
          required
          disabled={disabled}
          value={value.year}
          onChange={(event) => onChange({ ...value, year: event.target.value })}
        />
      </div>
      <details className={styles.technical}>
        <summary>More vehicle and part details, if known</summary>
        <p>Enter details you know. Leave uncertain information blank.</p>
        <div className={styles.fields}>
          {fitmentQualifierKeys.map((key) => (
            <div className="field" key={key}>
              <label htmlFor={`${id}-${key}`}>{fitmentLabels[key]}</label>
              <input
                id={`${id}-${key}`}
                maxLength={100}
                disabled={disabled}
                value={value.qualifiers[key] ?? ""}
                onChange={(event) =>
                  onChange({
                    ...value,
                    qualifiers: { ...value.qualifiers, [key]: event.target.value },
                  })
                }
              />
            </div>
          ))}
        </div>
      </details>
      {(model.error || model.refreshError) && (
        <div className={styles.technical}>
          <Feedback message="Saved vehicle names could not be loaded. Your saved selection is retained." />
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={model.refresh}
          >
            Retry vehicle names
          </button>
        </div>
      )}
    </div>
  );
}

export function PurchaseSuitability({
  order,
  guest = false,
  disabled = false,
  offerUnavailable = false,
  onSaved,
  onBusyChange,
}: {
  order: CustomerOrder;
  guest?: boolean;
  disabled?: boolean;
  offerUnavailable?: boolean;
  onSaved: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const [values, setValues] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      order.items.map((item) => [
        item.id,
        draft(
          order.purchaseReviews[0]?.requirements.lines.find(
            (line) => line.orderItemId === item.id,
          )?.selection,
        ),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string>(),
    [success, setSuccess] = useState<string>(),
    [uncertain, setUncertain] = useState(false),
    [previous, setPrevious] = useState<CustomerOrder[]>();
  const [sessionChanged, setSessionChanged] = useState(false);
  const pending = useRef<AbortController | null>(null),
    active = useRef(true);
  const retained = useRef<unknown>(null);
  const root = guest ? "/purchase/orders" : "/customers/orders";
  const request = guest ? purchaseRequest : apiRequest;
  useEffect(() => {
    active.current = true;
    const discard = () => {
      active.current = false;
      pending.current?.abort();
      retained.current = null;
      setValues({});
      setPrevious(undefined);
      setSessionChanged(true);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    const unsubscribe = guest ? subscribePurchaseAccess(discard) : undefined;
    return () => {
      active.current = false;
      pending.current?.abort();
      unsubscribe?.();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [guest]);
  function begin() {
    if (pending.current || disabled || sessionChanged) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    onBusyChange?.(true);
    setMessage(undefined);
    setSuccess(undefined);
    return controller;
  }
  function finish(controller: AbortController) {
    if (pending.current === controller) {
      pending.current = null;
      if (active.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  async function submit(retry = false) {
    const controller = begin();
    if (!controller) return;
    try {
      let body = retained.current;
      if (!retry) {
        const lines = order.items.map((item) => {
          const value = values[item.id] ?? draft();
          const selection = value.vehicle
            ? purchaseVehicleSelectionSchema.parse({
                vehicleModelId: value.modelId,
                ...(value.makeId ? { vehicleMakeId: value.makeId } : {}),
                year: Number(value.year),
                ...Object.fromEntries(
                  Object.entries(value.qualifiers)
                    .filter(([, text]) => text.trim())
                    .map(([key, text]) => [key, text.trim()]),
                ),
              })
            : null;
          return { orderItemId: item.id, selection };
        });
        body = {
          expectedVersion: order.version,
          expectedRevision: order.purchaseReviews[0]?.revision ?? 0,
          reason: "Customer confirmed the vehicle or requested suitability assistance",
          lines,
        };
        retained.current = body;
      }
      const result = await request(`${root}/${order.id}/purchase-review`, {
        method: "POST",
        body,
        csrf: !guest,
        signal: controller.signal,
      });
      const saved = parseOrder(result.data);
      if (saved.id !== order.id) throw Error("Unexpected order");
      if (active.current && !controller.signal.aborted) {
        retained.current = null;
        setUncertain(false);
        setSuccess(
          saved.purchaseReviews[0]?.status === "APPROVED"
            ? "Suitability and stock confirmed. You can continue to payment."
            : "We’ll check suitability and availability, then let you know when you can pay.",
        );
        onSaved();
      }
    } catch (error) {
      if (!active.current || controller.signal.aborted) return;
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        retained.current = null;
        setUncertain(false);
        setMessage(`${error.message} Your entered details are retained.`);
      } else if (!retained.current)
        setMessage(
          "Choose a model and valid year, or select ‘No vehicle / unsure’. Your details are retained.",
        );
      else {
        setUncertain(true);
        setMessage(
          "The outcome could not be confirmed. Check the saved details before changing or sending another request.",
        );
      }
    } finally {
      finish(controller);
    }
  }
  async function recover() {
    const controller = begin();
    if (!controller) return;
    try {
      const saved = parseOrder(
        (await request(`${root}/${order.id}`, { signal: controller.signal })).data,
      );
      const body = retained.current as {
        expectedRevision: number;
        lines: unknown;
      } | null;
      if (saved.id !== order.id) throw Error("Unexpected order");
      const review = saved.purchaseReviews[0];
      if (
        body &&
        review &&
        review.revision > body.expectedRevision &&
        JSON.stringify(review.requirements.lines) === JSON.stringify(body.lines)
      ) {
        retained.current = null;
        setUncertain(false);
        setSuccess("Your details were saved. Review the latest order status.");
        onSaved();
      } else
        setMessage(
          "The saved outcome does not confirm this request yet. You may retry the same details; the order version prevents applying them twice.",
        );
    } catch {
      if (active.current)
        setMessage(
          "Saved details could not be checked. Keep this page open and try again.",
        );
    } finally {
      finish(controller);
    }
  }
  async function loadPrevious() {
    const controller = begin();
    if (!controller) return;
    try {
      const saved = parseOrders(
        (await request(`${root}?limit=20`, { signal: controller.signal })).data,
      );
      if (active.current)
        setPrevious(
          saved.items.filter(
            (entry) => Object.keys(reusablePurchaseSelections(order, entry)).length > 0,
          ),
        );
    } catch {
      if (active.current)
        setMessage(
          "Previous purchases could not be loaded. You can still enter vehicle details below.",
        );
    } finally {
      finish(controller);
    }
  }
  if (order.paidAt || order.status !== "PENDING") return null;
  if (sessionChanged)
    return (
      <Feedback message="Your access changed. Refresh the page before continuing." />
    );
  const locked = disabled || busy || uncertain;
  const approved = order.purchaseReviews[0]?.status === "APPROVED" && !offerUnavailable;
  return (
    <section className={styles.panel} aria-labelledby={`${id}-title`} aria-busy={busy}>
      <h2 id={`${id}-title`}>Suitability and availability</h2>
      <p>
        Known suitability and available stock are checked automatically. We’ll ask the
        team only when more information is needed.
      </p>
      {approved && (
        <div className={styles.approved}>
          <p>
            Checks completed. Review the payment section for the current payment window.
          </p>
          <a
            className={`button ${styles.paymentLink}`}
            href={guest ? "#purchase-next-step" : "#order-payment-title"}
          >
            View payment options
          </a>
        </div>
      )}
      {!offerUnavailable &&
        order.purchaseReviews[0]?.availability
          ?.filter((line) => line.kind === "SUPPLIER")
          .map((line) => (
            <p key={line.orderItemId}>
              {order.items.find((item) => item.id === line.orderItemId)?.productName ??
                "Part"}
              : supplier arrival estimate {formatBusinessDate(line.expectedFrom)} to{" "}
              {formatBusinessDate(line.expectedTo)}. We’ll confirm readiness for
              collection separately.
            </p>
          ))}
      <Feedback message={message} scrollToMessage />
      <Feedback
        message={offerUnavailable ? undefined : success}
        tone="success"
        scrollToMessage
      />
      {offerUnavailable && (
        <p>
          This offer needs a new check. Review the details below and check availability
          again.
        </p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={disabled || busy}
        onClick={onSaved}
      >
        Refresh order status
      </button>
      <details open={!approved || uncertain}>
        <summary>
          {approved ? "Change vehicle or part details" : "Enter or reuse vehicle details"}
        </summary>
        {uncertain ? (
          <div className={styles.actions}>
            <button
              type="button"
              className="button"
              disabled={disabled || busy}
              onClick={() => void recover()}
            >
              Check saved details
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={disabled || busy}
              onClick={() => void submit(true)}
            >
              Retry the same details
            </button>
          </div>
        ) : (
          <>
            <details>
              <summary>Use details from a previous purchase</summary>
              <p>
                Choose the same vehicle only if these parts are for that vehicle. We’ll
                check current suitability and stock again.
              </p>
              <button
                type="button"
                className="button secondary"
                disabled={locked}
                onClick={() => void loadPrevious()}
              >
                {busy ? "Checking…" : "Find previous purchases"}
              </button>
              {previous?.length === 0 && (
                <p>No matching vehicle details were found in the latest 20 purchases.</p>
              )}
              {previous?.map((entry) => (
                <button
                  className="button secondary"
                  type="button"
                  key={entry.id}
                  disabled={locked}
                  onClick={() => {
                    const selections = reusablePurchaseSelections(order, entry);
                    setValues((old) => ({
                      ...old,
                      ...Object.fromEntries(
                        Object.entries(selections).map(([key, value]) => [
                          key,
                          draft(value),
                        ]),
                      ),
                    }));
                    setSuccess(
                      `Vehicle details copied from ${entry.orderNumber}. Check them below before continuing.`,
                    );
                  }}
                >
                  Use details from {entry.orderNumber}
                </button>
              ))}
            </details>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <fieldset disabled={locked} className={styles.form}>
                <legend className={styles.srOnly}>
                  Confirm the intended use of each part
                </legend>
                {order.items.map((item) => {
                  const value = values[item.id] ?? draft();
                  const lineId = `${id}-${item.id}`;
                  return (
                    <fieldset key={item.id} className={styles.item}>
                      <legend>
                        {item.productName} · Quantity {item.quantity}
                      </legend>
                      <div className="field">
                        <label htmlFor={`${lineId}-use`}>Intended use</label>
                        <select
                          id={`${lineId}-use`}
                          value={value.vehicle ? "vehicle" : "help"}
                          onChange={(event) =>
                            setValues((old) => ({
                              ...old,
                              [item.id]: {
                                ...value,
                                vehicle: event.target.value === "vehicle",
                              },
                            }))
                          }
                        >
                          <option value="help">No vehicle / unsure</option>
                          <option value="vehicle">For a vehicle</option>
                        </select>
                      </div>
                      {value.vehicle && (
                        <VehicleFields
                          id={lineId}
                          disabled={locked}
                          value={value}
                          onChange={(next) =>
                            setValues((old) => ({ ...old, [item.id]: next }))
                          }
                        />
                      )}
                    </fieldset>
                  );
                })}
                <button type="submit" className="button">
                  {busy ? "Checking details…" : "Check details and availability"}
                </button>
              </fieldset>
            </form>
          </>
        )}
      </details>
    </section>
  );
}
