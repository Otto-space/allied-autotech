"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  invoiceSourceType,
  invoiceSourceLabels,
  invoiceSource,
  parseInvoiceSources,
  parseWorkInvoices,
  confirmInvoiceDraft,
  type InvoiceSource,
  type InvoiceCreateBody,
  type WorkInvoice,
} from "@/lib/admin/work-invoices";
import {
  markInvoicePending,
  readInvoicePending,
  clearInvoicePending,
  invoiceFingerprint,
  forgetInvoiceDraft,
  redactInvoiceChanges,
  type InvoicePending,
} from "@/lib/admin/work-invoice-pending";
import { InvoiceSourcePicker } from "./invoice-source-picker";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
const dueTimestamp = (v: string) => `${v}:00+01:00`;
const schema = z.object({
  sourceType: invoiceSourceType,
  sourceId: z.uuid("Choose an invoice source."),
  dueAt: z
    .string()
    .refine(
      (v) =>
        !v ||
        (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) &&
          new Date(dueTimestamp(v)).getTime() > Date.now()),
      "Choose a future due date in Lagos time.",
    ),
});
type Values = z.infer<typeof schema>;
export function InvoiceCreateForm({
  onSaved,
  owner,
  role,
  disabled = false,
  onDenied,
}: {
  onSaved: () => void;
  owner: string;
  role: string;
  disabled?: boolean;
  onDenied: () => void;
}) {
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [source, setSource] = useState<InvoiceSource>(),
    [pending, setPending] = useState<InvoicePending | undefined>(() =>
      readInvoicePending(owner, role),
    ),
    [saved, setSaved] = useState<WorkInvoice>(),
    [current, setCurrent] = useState<{
      invoice?: WorkInvoice;
      sourceType: Values["sourceType"];
      sourceId: string;
    }>(),
    [message, setMessage] = useState<string>(),
    [checking, setChecking] = useState(false),
    [acknowledged, setAcknowledged] = useState(false),
    [generation, setGeneration] = useState(0),
    [manualKind, setManualKind] = useState<Values["sourceType"]>("ORDER"),
    [manualId, setManualId] = useState("");
  const active = useRef(true),
    flight = useRef(false),
    controller = useRef<AbortController | null>(null),
    focus = useRef<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    shouldFocusError: false,
    defaultValues: { sourceType: "ORDER", sourceId: "", dueAt: "" },
  });
  const kind = useWatch({ control: form.control, name: "sourceType" }),
    selectedId = useWatch({ control: form.control, name: "sourceId" }),
    errors = form.formState.errors;
  const sourceParams = new URLSearchParams({
    sourceType: kind,
    sourceId: selectedId,
    limit: "25",
  });
  const parseExisting = useCallback(
    (v: unknown) =>
      parseWorkInvoices(
        v,
        new URLSearchParams({ sourceType: kind, sourceId: selectedId }),
      ),
    [kind, selectedId],
  );
  const existing = useResource(
    selectedId && z.uuid().safeParse(selectedId).success && !pending
      ? `/staff/invoices?${sourceParams}`
      : null,
    parseExisting,
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (existing.denied) onDenied();
  }, [existing.denied, onDenied]);
  useEffect(() => {
    if (proposal || !focus.current) return;
    const timer = requestAnimationFrame(() => {
      const node = document.getElementById(focus.current ?? "");
      focus.current = null;
      node?.focus({ preventScroll: true });
      node?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(timer);
  }, [proposal, saved, current, pending]);
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Invoice account changed");
  }
  async function access(signal: AbortSignal) {
    const p = parseOwnStaffProfile((await apiRequest("/staff/profile", { signal })).data);
    identity(signal);
    if (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
  }
  async function currentInvoice(
    sourceType: Values["sourceType"],
    sourceId: string,
    signal: AbortSignal,
  ) {
    const q = new URLSearchParams({ sourceType, sourceId, limit: "25" }),
      p = parseWorkInvoices(
        (await apiRequest(`/staff/invoices?${q}`, { signal })).data,
        q,
      );
    identity(signal);
    if (p.items.length > 1 || p.nextCursor)
      throw Error("Source invoice could not be confirmed");
    return p.items[0];
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      redactInvoiceChanges();
      onDenied();
      return true;
    }
    return false;
  }
  async function review(values: Values) {
    if (
      flight.current ||
      proposal ||
      pending ||
      disabled ||
      !source ||
      source.id !== values.sourceId ||
      existing.loading ||
      existing.refreshing ||
      existing.error ||
      existing.refreshError ||
      existing.data?.items.length
    )
      return;
    const selected = source,
      body: InvoiceCreateBody = {
        sourceType: values.sourceType,
        sourceId: values.sourceId,
        ...(values.dueAt ? { dueAt: dueTimestamp(values.dueAt) } : {}),
      };
    setMessage(undefined);
    setProposal({
      title: "Create this draft invoice?",
      description:
        "The server calculates the amount from the source record, including eligible booking deposit credit. Review and issue the draft separately. Creating it does not record or collect a payment.",
      facts: [
        { label: "Source type", value: invoiceSourceLabels[selected.sourceType] },
        { label: "Source", value: selected.label },
        { label: "Source reference", value: selected.id },
        { label: "Branch", value: selected.branch?.name ?? "Unassigned branch" },
        {
          label: "Due date (Lagos)",
          value: body.dueAt ? formatStockInstant(body.dueAt) : "Not set",
        },
      ],
      retryAfterRejection: false,
      onUncertain: () => {
        setPending(readInvoicePending(owner, role));
        focus.current = "invoice-recovery-heading";
      },
      submit: async () => {
        if (flight.current)
          throw new ApiError(409, {
            message: "An invoice request is already in progress.",
          });
        flight.current = true;
        controller.current?.abort();
        const c = new AbortController();
        controller.current = c;
        let sent = false,
          marker: Exclude<InvoicePending, "unknown"> | undefined;
        try {
          await access(c.signal);
          if (readInvoicePending(owner, role))
            throw Error("A previous creation needs reconciliation.");
          const already = await currentInvoice(body.sourceType, body.sourceId, c.signal);
          if (already) {
            setCurrent({
              invoice: already,
              sourceType: body.sourceType,
              sourceId: body.sourceId,
            });
            focus.current = "invoice-current-heading";
            throw Error(
              "An invoice already exists for this source. Open its current record.",
            );
          }
          const fresh = parseInvoiceSources(
            (
              await apiRequest(
                `/staff/invoices/sources?sourceType=${body.sourceType}&sourceId=${body.sourceId}&limit=25`,
                { signal: c.signal },
              )
            ).data,
            body.sourceType,
            body.sourceId,
          ).items[0];
          identity(c.signal);
          if (!fresh || JSON.stringify(fresh) !== JSON.stringify(selected))
            throw Error(
              "The selected source changed. Refresh it and review a new request.",
            );
          if (body.dueAt && Date.parse(body.dueAt) <= Date.now())
            throw Error("Choose a future due date and review again.");
          const fingerprint = await invoiceFingerprint(body);
          identity(c.signal);
          marker = markInvoicePending(owner, role, {
            sourceType: body.sourceType,
            sourceId: body.sourceId,
            fingerprint,
          });
          setPending(marker);
          sent = true;
          const response = await apiRequest("/staff/invoices", {
            method: "POST",
            body,
            csrf: true,
            signal: c.signal,
          });
          identity(c.signal);
          const invoice = confirmInvoiceDraft(response.data, body, fresh);
          clearInvoicePending(owner, role, marker.token);
          forgetInvoiceDraft(owner, role);
          setPending(undefined);
          setSaved(invoice);
          setCurrent(undefined);
          focus.current = "invoice-saved-heading";
          onSaved();
        } catch (error) {
          if (!active.current) throw error;
          if (denied(error)) throw error;
          const definite =
            error instanceof ApiError &&
            error.status >= 400 &&
            error.status < 500 &&
            ![408, 429].includes(error.status);
          if (!sent || definite) {
            if (marker) {
              clearInvoicePending(owner, role, marker.token);
              setPending(undefined);
            }
            setMessage(
              !sent
                ? `No creation request was sent. ${error instanceof Error ? error.message : "Refresh the source and review again."}`
                : "The server rejected this request. Review the current source before submitting again.",
            );
            if (!sent || !(error instanceof ApiError))
              throw new ApiError(409, {
                message:
                  "No creation request was sent. Close the review and check the source.",
              });
            throw error;
          }
          setPending(readInvoicePending(owner, role));
          focus.current = "invoice-recovery-heading";
          throw Error("The creation outcome could not be confirmed.");
        } finally {
          flight.current = false;
        }
      },
    });
  }
  async function reconcile() {
    if (flight.current || disabled) return;
    const sourceType = pending && pending !== "unknown" ? pending.sourceType : manualKind,
      sourceId =
        pending && pending !== "unknown"
          ? pending.sourceId
          : manualId.trim().toLowerCase();
    if (!z.uuid().safeParse(sourceId).success) {
      setMessage("Enter the exact source UUID to inspect its current invoice.");
      return;
    }
    flight.current = true;
    setChecking(true);
    setMessage(undefined);
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    try {
      await access(c.signal);
      const invoice = await currentInvoice(sourceType, sourceId, c.signal);
      identity(c.signal);
      setCurrent({ invoice, sourceType, sourceId });
      setAcknowledged(false);
      focus.current = "invoice-current-heading";
    } catch (error) {
      if (active.current && !denied(error))
        setMessage(
          "The current source invoice could not be checked. The creation lock remains in place.",
        );
    } finally {
      flight.current = false;
      if (active.current) setChecking(false);
    }
  }
  function startAnother() {
    if (!current?.invoice || !acknowledged || disabled) return;
    try {
      clearInvoicePending(
        owner,
        role,
        pending && pending !== "unknown" ? pending.token : undefined,
      );
      forgetInvoiceDraft(owner, role);
      setPending(undefined);
      setSaved(undefined);
      setCurrent(undefined);
      setSource(undefined);
      form.reset({ sourceType: "ORDER", sourceId: "", dueAt: "" });
      setGeneration((v) => v + 1);
      setMessage(
        "Local draft cleared. Any earlier server request is unaffected. Choose a source and review a new draft.",
      );
      requestAnimationFrame(() =>
        document.getElementById("invoice-source-type")?.focus(),
      );
    } catch {
      setMessage(
        "The creation lock could not be cleared. Keep the current invoice reference and try again.",
      );
    }
  }
  const locked = disabled || !!pending || checking || !!saved;
  return (
    <section className="iv-create panel" aria-labelledby="invoice-create-heading">
      <div className="iv-create-intro">
        <p className="iv-eyebrow">01 / Prepare a draft</p>
        <h2 id="invoice-create-heading">Create an invoice</h2>
        <p>
          Choose the record to bill. Its recorded figures determine the invoice value.
        </p>
        <ul>
          <li>Orders use their recorded total.</li>
          <li>Bookings require an accepted quotation.</li>
          <li>Vehicle purchases require an agreed price and eligible status.</li>
        </ul>
        <p className="field-hint">
          The draft must be reviewed and issued separately. No payment is collected here.
        </p>
      </div>
      <div className="iv-create-workspace">
        <Feedback message={message} />
        {saved && (
          <section className="iv-result" aria-labelledby="invoice-saved-heading">
            <h3 id="invoice-saved-heading" tabIndex={-1}>
              Draft invoice created
            </h3>
            <p>
              {saved.invoiceNumber} · {formatKobo(saved.totalKobo)}
            </p>
            <p>Saved as a draft. Review its details before issuing.</p>
            <Link className="button secondary" href={`/admin/invoices/${saved.id}`}>
              View draft invoice
            </Link>
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setCurrent({
                  invoice: saved,
                  sourceType: invoiceSource(saved).kind,
                  sourceId: invoiceSource(saved).id,
                });
                focus.current = "invoice-current-heading";
              }}
            >
              Prepare another invoice
            </button>
          </section>
        )}
        {pending && (
          <section className="iv-recovery" aria-labelledby="invoice-recovery-heading">
            <h3 id="invoice-recovery-heading" tabIndex={-1}>
              Creation outcome needs checking
            </h3>
            <p>
              This request will not be sent again. Load the current source invoice to
              inspect what is recorded now.
            </p>
            {pending === "unknown" ? (
              <>
                <p>
                  The original source reference was redacted or could not be restored.
                  Independently reconcile the original request before clearing its local
                  lock.
                </p>
                <div className="field">
                  <label htmlFor="invoice-recovery-kind">Source type to inspect</label>
                  <select
                    id="invoice-recovery-kind"
                    value={manualKind}
                    onChange={(e) => {
                      const v = invoiceSourceType.safeParse(e.target.value);
                      if (v.success) {
                        setManualKind(v.data);
                        setCurrent(undefined);
                      }
                    }}
                  >
                    {Object.entries(invoiceSourceLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="invoice-recovery-reference">
                    Source UUID to inspect
                  </label>
                  <input
                    id="invoice-recovery-reference"
                    value={manualId}
                    maxLength={36}
                    autoComplete="off"
                    onChange={(e) => {
                      setManualId(e.target.value);
                      setCurrent(undefined);
                    }}
                  />
                </div>
              </>
            ) : (
              <p>
                {invoiceSourceLabels[pending.sourceType]}
                <br />
                <span className="iv-reference">{pending.sourceId}</span>
              </p>
            )}
            <button
              type="button"
              className="button secondary"
              disabled={checking || disabled || !!proposal}
              onClick={() => void reconcile()}
            >
              {checking ? "Checking current source…" : "Load current source invoice"}
            </button>
          </section>
        )}
        {current && (
          <section className="iv-result" aria-labelledby="invoice-current-heading">
            <h3 id="invoice-current-heading" tabIndex={-1}>
              Current source invoice
            </h3>
            <p className="iv-reference">
              {invoiceSourceLabels[current.sourceType]} · {current.sourceId}
            </p>
            {current.invoice ? (
              <>
                <p>
                  {current.invoice.invoiceNumber} ·{" "}
                  {formatKobo(current.invoice.totalKobo)} ·{" "}
                  {current.invoice.status.toLowerCase()}
                </p>
                <Link
                  className="text-link"
                  href={`/admin/invoices/${current.invoice.id}`}
                >
                  View current invoice
                </Link>
                <p>
                  This read shows the current source mapping. It does not prove which
                  request created the invoice.
                </p>
                <label className="iv-ack">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  I have independently reconciled the earlier creation and can clear this
                  local draft.
                </label>
                <button
                  type="button"
                  className="button secondary"
                  disabled={!acknowledged || disabled}
                  onClick={startAnother}
                >
                  Clear reconciled draft
                </button>
              </>
            ) : (
              <p>
                No invoice is currently returned for this source. This does not prove that
                an earlier request failed or cannot still finish. Keep checking; the local
                creation lock remains.
              </p>
            )}
          </section>
        )}
        <form
          data-draft-key="invoice-create:1"
          noValidate
          onSubmit={(event) =>
            void form.handleSubmit(
              (v) => void review(v),
              (v) => {
                const first = (["sourceType", "sourceId", "dueAt"] as const).find(
                  (k) => v[k],
                );
                if (first) form.setFocus(first);
              },
            )(event)
          }
        >
          <fieldset disabled={locked}>
            <legend className="sr-only">Invoice source and due date</legend>
            <p className="iv-eyebrow">02 / Source & due date</p>
            <div className="field">
              <label htmlFor="invoice-source-type">Invoice source type</label>
              <select
                id="invoice-source-type"
                {...form.register("sourceType")}
                onChange={(e) => {
                  const v = invoiceSourceType.safeParse(e.target.value);
                  if (v.success) {
                    form.setValue("sourceType", v.data);
                    form.setValue("sourceId", "");
                    setSource(undefined);
                    setCurrent(undefined);
                  }
                }}
              >
                {Object.entries(invoiceSourceLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field iv-source-field">
              <Controller
                control={form.control}
                name="sourceId"
                render={({ field }) => (
                  <InvoiceSourcePicker
                    key={`${kind}:${generation}`}
                    kind={kind}
                    value={field.value}
                    inputRef={field.ref}
                    error={errors.sourceId?.message}
                    onSelected={setSource}
                    onDenied={onDenied}
                    onChange={(id) => {
                      field.onChange(id);
                      setCurrent(undefined);
                    }}
                  />
                )}
              />
            </div>
            <div className="field">
              <label htmlFor="invoice-due">Due date (optional, Lagos time)</label>
              <input
                id="invoice-due"
                type="datetime-local"
                {...form.register("dueAt")}
                aria-invalid={!!errors.dueAt}
                aria-describedby={errors.dueAt ? "invoice-due-error" : undefined}
              />
              {errors.dueAt && (
                <p id="invoice-due-error" className="field-error" role="alert">
                  {errors.dueAt.message}
                </p>
              )}
            </div>
            {selectedId && existing.loading && (
              <p role="status">Checking existing source invoice…</p>
            )}
            <Feedback message={existing.error || existing.refreshError} />
            {(existing.error || existing.refreshError) && (
              <button type="button" className="text-link" onClick={existing.refresh}>
                Retry source invoice check
              </button>
            )}
            {!!existing.data?.items.length && (
              <p className="iv-existing">
                This source already has an invoice.{" "}
                <Link
                  className="text-link"
                  href={`/admin/invoices/${existing.data.items[0].id}`}
                >
                  View existing invoice
                </Link>
              </p>
            )}
            <button
              className="button"
              disabled={
                !source ||
                source.id !== selectedId ||
                existing.loading ||
                existing.refreshing ||
                !!existing.error ||
                !!existing.refreshError ||
                !!existing.data?.items.length
              }
            >
              Review draft invoice
            </button>
          </fieldset>
        </form>
      </div>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Create draft invoice"
          exposeBusyState
          onClose={() => {
            setProposal(null);
            if (!focus.current)
              requestAnimationFrame(() =>
                document
                  .querySelector<HTMLElement>(
                    '.iv-create button[type="submit"], .iv-create form button.button:last-child',
                  )
                  ?.focus(),
              );
          }}
          onSuccess={() => undefined}
        />
      )}
    </section>
  );
}
