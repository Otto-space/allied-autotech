"use client";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import type { WorkCustomer } from "@/lib/admin/work-customers";
import { Feedback } from "./feedback";

export function CustomerAccountAction({
  customer,
  disabled = false,
  onChanged,
}: {
  customer: WorkCustomer;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (customer.status === "DEACTIVATED") return null;
  const action = customer.status === "ACTIVE" ? "Suspend account" : "Reactivate account";
  return (
    <>
      <button
        type="button"
        className={`button secondary${customer.status === "ACTIVE" ? " account-danger" : ""}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {action}
        <span className="sr-only">
          {" "}
          for {customer.firstName} {customer.lastName}
        </span>
      </button>
      {open && (
        <AccountDialog
          customer={customer}
          action={action}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
function AccountDialog({
  customer,
  action,
  onClose,
  onChanged,
}: {
  customer: WorkCustomer;
  action: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<Element | null>(null),
    active = useRef(true),
    submitting = useRef(false);
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    active.current = true;
    opener.current ??= document.activeElement;
    dialog.current?.showModal();
    return () => {
      active.current = false;
      const previous = opener.current;
      queueMicrotask(() => {
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      });
    };
  }, []);
  async function submit() {
    if (submitting.current || uncertain) return;
    if (reason.trim().length < 10) {
      setError("Explain the reason in 10–1,000 characters.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await apiRequest<{ customerId: string; status: string }>(
        `/admin/customers/${customer.id}/account-status`,
        {
          method: "POST",
          csrf: true,
          body: {
            expectedStatus: customer.status,
            status: customer.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
            reason: reason.trim(),
          },
        },
      );
      if (!active.current) return;
      if (
        !result.data ||
        result.data.customerId !== customer.id ||
        result.data.status !== (customer.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE")
      )
        throw new Error("Unexpected result");
      onChanged();
      onClose();
    } catch {
      if (!active.current) return;
      setUncertain(true);
      setError(
        "The change could not be confirmed. Close this dialog and refresh the customer before reviewing another action.",
      );
      onChanged();
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="mutation-dialog"
      aria-labelledby="customer-account-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="customer-account-title">{action}</h2>
      <p>
        <strong>
          {`${customer.firstName} ${customer.lastName}`.trim() || "Unnamed customer"}
        </strong>{" "}
        · {customer.email}
      </p>
      <p>
        {customer.status === "ACTIVE"
          ? "Suspension blocks sign-in and protected account access, ends existing sessions and revokes unused password-reset and verification links. Customer records, support history and financial obligations are preserved."
          : "Reactivation allows the customer to sign in again. Previously revoked sessions and links remain revoked."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="field">
          <label htmlFor="customer-account-reason">Reason (required)</label>
          <textarea
            id="customer-account-reason"
            value={reason}
            minLength={10}
            maxLength={1000}
            required
            disabled={busy || uncertain}
            onChange={(event) => setReason(event.target.value)}
            aria-describedby="customer-account-hint"
          />
          <p id="customer-account-hint" className="field-hint">
            10–1,000 characters. Recorded privately in the administrative audit log.
          </p>
        </div>
        <Feedback message={error} />
        <div className="actions">
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`button${customer.status === "ACTIVE" ? " account-danger" : ""}`}
            type="submit"
            disabled={busy || uncertain}
          >
            {busy ? "Saving account status…" : action}
          </button>
        </div>
      </form>
    </dialog>
  );
}
