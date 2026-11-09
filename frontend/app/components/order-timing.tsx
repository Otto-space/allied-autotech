"use client";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { ApiError, apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import {
  parseStaffOrderDetail,
  type StaffOrderRecord,
} from "@/lib/admin/work-order-detail";
import {
  timingSignature,
  sourcingLabels,
  timingLineSchema,
  type TimingUpdate,
} from "@/lib/order-timing";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import styles from "./order-timing.module.css";

type Item = { id: string; productName: string };
export function OrderTimingSummary({
  updates = [],
  items,
}: {
  updates?: TimingUpdate[];
  items: Item[];
}) {
  const title = useId(),
    latest = updates[0];
  if (!latest) return null;
  if (
    latest.lines.length !== items.length ||
    new Set(latest.lines.map((line) => line.orderItemId)).size !== items.length ||
    latest.lines.some((line) => !items.some((item) => item.id === line.orderItemId))
  )
    return (
      <Feedback message="The sourcing update does not match this order. Refresh before relying on it." />
    );
  return (
    <section
      className={`card ${styles.section}`}
      aria-labelledby={title}
      data-order-timing-summary
    >
      <h2 id={title}>Sourcing and preparation</h2>
      <p>{latest.customerNote}</p>
      <ul>
        {latest.lines.map((line) => (
          <li key={line.orderItemId}>
            <strong>
              {items.find((item) => item.id === line.orderItemId)?.productName}
            </strong>
            <p>{sourcingLabels[line.sourcingStatus]}</p>
            {line.sourcingFrom && line.sourcingUntil ? (
              <p>
                Estimated arrival: {formatBusinessDate(line.sourcingFrom)} –{" "}
                {formatBusinessDate(line.sourcingUntil)}
              </p>
            ) : (
              <p>Arrival estimate not recorded.</p>
            )}
            <p>
              {line.preparationMinutes === null
                ? "Preparation time not yet confirmed."
                : `Estimated preparation after arrival: ${line.preparationMinutes} minutes.`}
            </p>
          </li>
        ))}
      </ul>
      <p>
        Updated {formatBusinessDate(latest.createdAt)}. Estimates may change. This is
        separate from ready-for-collection confirmation.
      </p>
    </section>
  );
}
export function OrderTimingEditor({
  order,
  disabled,
  onBusyChange,
  onSaved,
}: {
  order: StaffOrderRecord;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (message?: string) => void;
}) {
  const id = useId();
  const latest = order.timingUpdates?.[0];
  const [statuses, setStatuses] = useState<Record<string, keyof typeof sourcingLabels>>(
    () =>
      Object.fromEntries(
        latest?.lines.map((line) => [line.orderItemId, line.sourcingStatus]) ?? [],
      ),
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [error, setError] = useState<string>(),
    [uncertain, setUncertain] = useState(false),
    [changed, setChanged] = useState(false);
  const validationRef = useRef<HTMLDivElement>(null);
  const active = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    const discard = () => {
      active.current = false;
      controller.current?.abort();
      setProposal(null);
      setChanged(true);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      controller.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  useEffect(() => {
    if (error) {
      validationRef.current?.focus({ preventScroll: true });
      validationRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);
  if (!order.timingUpdates || ["READY", "COMPLETED", "CANCELLED"].includes(order.status))
    return null;
  function review(form: FormData) {
    if (disabled || proposal || uncertain || changed) return;
    setError(undefined);
    try {
      const paragraph = z
        .string()
        .trim()
        .min(1)
        .max(1000)
        .refine((value) => !/[\x00-\x1f\x7f]/.test(value));
      const lines = order.items.map((item) => {
        const status = statuses[item.id] ?? "UNKNOWN",
          sourced = ["SUPPLIER_CONFIRMED", "ORDERED", "IN_TRANSIT"].includes(status);
        const timestamp = (field: string) => {
          const value = String(form.get(`${item.id}-${field}`) ?? "");
          return value && sourced ? new Date(`${value}:00+01:00`).toISOString() : null;
        };
        const minutes = String(form.get(`${item.id}-preparation`) ?? "").trim();
        return timingLineSchema.parse({
          orderItemId: item.id,
          sourcingStatus: status,
          sourcingFrom: timestamp("from"),
          sourcingUntil: timestamp("until"),
          preparationMinutes: minutes === "" ? null : Number(minutes),
        });
      });
      const body = {
        expectedVersion: order.version,
        idempotencyKey: crypto.randomUUID(),
        lines,
        customerNote: paragraph.parse(form.get("customerNote")),
        reason: paragraph.parse(form.get("reason")),
      };
      setProposal({
        title: "Update sourcing estimates?",
        description:
          "Save this update for this order. Payment, stock allocation, readiness and collection deadlines stay separate.",
        facts: [
          { label: "Order", value: order.orderNumber },
          { label: "Customer update", value: body.customerNote },
          { label: "Internal reason", value: body.reason },
          ...lines.map((line, index) => ({
            label: order.items[index].productName,
            value: `${sourcingLabels[line.sourcingStatus]}; ${line.sourcingFrom ? `${formatBusinessDate(line.sourcingFrom)} to ${formatBusinessDate(line.sourcingUntil!)}` : "arrival unknown"}; preparation ${line.preparationMinutes === null ? "unknown" : `${line.preparationMinutes} minutes`}`,
          })),
        ],
        submit: async () => {
          const abort = new AbortController();
          controller.current = abort;
          onBusyChange(true);
          let submitted = false;
          try {
            const fresh = parseStaffOrderDetail(
              (await apiRequest(`/staff/orders/${order.id}`, { signal: abort.signal }))
                .data,
            );
            if (
              fresh.id !== order.id ||
              fresh.version !== order.version ||
              fresh.status !== order.status
            )
              throw Error("The order changed. Refresh and review the current details.");
            submitted = true;
            const saved = parseStaffOrderDetail(
              (
                await apiRequest(`/admin/orders/${order.id}/timing`, {
                  method: "POST",
                  csrf: true,
                  body,
                  signal: abort.signal,
                })
              ).data,
            );
            if (
              saved.id !== order.id ||
              saved.version !== order.version + 1 ||
              !saved.timingUpdates?.[0] ||
              saved.timingUpdates[0].orderVersion !== order.version ||
              timingSignature(saved.timingUpdates[0].lines) !==
                timingSignature(body.lines) ||
              saved.timingUpdates[0].customerNote !== body.customerNote
            )
              throw Error(
                "The update could not be confirmed. Refresh to check the saved order before trying again.",
              );
          } catch (cause) {
            if (!active.current) return;
            if (
              submitted &&
              !(cause instanceof ApiError && cause.status >= 400 && cause.status < 500)
            )
              setUncertain(true);
            throw cause;
          } finally {
            if (active.current) onBusyChange(false);
          }
        },
      });
    } catch {
      setError(
        "Check the sourcing dates, whole-minute preparation time and both notes. Use up to 1,000 characters per note.",
      );
    }
  }
  const local = (value: string | null | undefined) =>
    value ? new Date(Date.parse(value) + 3600000).toISOString().slice(0, 16) : "";
  return (
    <section className={`card ${styles.section}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Update this order’s sourcing</h2>
      <p>
        Record genuine supplier or import progress. Dates use Nigeria time. Leave unknown
        estimates blank; zero preparation means no additional preparation.
      </p>
      {changed && <Feedback message="Your account changed. Refresh before continuing." />}
      {uncertain && (
        <Feedback message="The save outcome is uncertain. Close the review and refresh the order before trying again." />
      )}
      {error && (
        <div tabIndex={-1} ref={validationRef}>
          <Feedback message={error} />
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          review(new FormData(event.currentTarget));
        }}
      >
        <fieldset
          className={styles.fields}
          disabled={disabled || !!proposal || uncertain || changed}
        >
          {order.items.map((item) => {
            const previous = latest?.lines.find((line) => line.orderItemId === item.id),
              status = statuses[item.id] ?? "UNKNOWN",
              sourced = ["SUPPLIER_CONFIRMED", "ORDERED", "IN_TRANSIT"].includes(status);
            return (
              <fieldset key={item.id} className={styles.item}>
                <legend>{item.productName}</legend>
                <label htmlFor={`${id}-${item.id}-status`}>Sourcing status</label>
                <select
                  id={`${id}-${item.id}-status`}
                  className="input"
                  value={status}
                  onChange={(event) =>
                    setStatuses((value) => ({
                      ...value,
                      [item.id]: event.target.value as keyof typeof sourcingLabels,
                    }))
                  }
                >
                  {Object.entries(sourcingLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {sourced && (
                  <div className={styles.dates}>
                    {["from", "until"].map((field) => (
                      <label key={field}>
                        Estimated arrival {field === "from" ? "from" : "by"} (Nigeria
                        time)
                        <input
                          className="input"
                          type="datetime-local"
                          name={`${item.id}-${field}`}
                          defaultValue={local(
                            field === "from"
                              ? previous?.sourcingFrom
                              : previous?.sourcingUntil,
                          )}
                        />
                      </label>
                    ))}
                  </div>
                )}
                <label>
                  Preparation after arrival (minutes, optional)
                  <input
                    className="input"
                    type="number"
                    min="0"
                    max="525600"
                    step="1"
                    name={`${item.id}-preparation`}
                    defaultValue={previous?.preparationMinutes ?? ""}
                  />
                </label>
              </fieldset>
            );
          })}
          <label>
            Update shown to the customer
            <textarea
              className="input"
              name="customerNote"
              required
              maxLength={1000}
              defaultValue={latest?.customerNote ?? ""}
            />
          </label>
          <label>
            Internal reason (not shown to the customer)
            <textarea className="input" name="reason" required maxLength={1000} />
          </label>
          <button className="button" type="submit">
            Review sourcing update
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          confirmLabel="Save sourcing update"
          onSuccess={() =>
            onSaved("Sourcing update saved. Readiness and payment are unchanged.")
          }
        />
      )}
    </section>
  );
}
