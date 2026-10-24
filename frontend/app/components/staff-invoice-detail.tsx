"use client";
import { NotificationRecordContext } from "./notification-record-context";
import { WorkflowProgress } from "./status-progress";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, RefreshCw } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import { formatKobo } from "@/lib/format/money";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import {
  invoiceSource,
  invoiceSourceLabels,
  invoiceStatusLabels,
  type WorkInvoice,
} from "@/lib/admin/work-invoices";
import {
  parseInvoiceDetail,
  parseStaffInvoiceDocument,
  invoiceDocumentMatches,
  invoiceCanTransition,
  invoiceDetailSnapshot,
  validateInvoiceTransition,
  type InvoiceAction,
  type InvoiceTransition,
} from "@/lib/admin/work-invoice-detail";
import {
  invoiceFingerprint,
  redactInvoiceChanges,
} from "@/lib/admin/work-invoice-pending";
import {
  readInvoiceTransitionPending,
  markInvoiceTransitionPending,
  clearInvoiceTransitionPending,
  type InvoiceTransitionPending,
} from "@/lib/admin/work-invoice-transition-pending";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { StaffInvoicePaper, StaffInvoiceLifecycle } from "./staff-invoice-paper";
import { DocumentActions } from "./document-actions";

export function StaffInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  return ["ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <InvoiceAccess
      key={`${session.user.id}:${session.user.role}:${invoiceId}`}
      invoiceId={invoiceId}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <div className="work-inspections work-invoice-detail">
      <h1>Invoice details</h1>
      <Feedback message="Administrator access is required for finance." />
    </div>
  );
}
function InvoiceAccess({
  invoiceId,
  owner,
  role,
}: {
  invoiceId: string;
  owner: string;
  role: string;
}) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
        ? "Current administrator access could not be confirmed."
        : undefined);
  useEffect(() => {
    if (
      access.denied ||
      (p && (p.id !== owner || p.role !== role || p.status !== "ACTIVE"))
    )
      redactInvoiceChanges();
  }, [access.denied, p, owner, role]);
  if (!p || error || access.loading)
    return (
      <div className="work-inspections work-invoice-detail">
        <h1>Invoice details</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking invoice access…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh invoice access
        </button>
      </div>
    );
  return (
    <InvoiceWorkspace
      owner={owner}
      role={role}
      invoiceId={invoiceId}
      refreshAccess={access.refresh}
      accessBusy={access.loading || access.refreshing}
    />
  );
}
function InvoiceWorkspace({
  owner,
  role,
  invoiceId,
  refreshAccess,
  accessBusy,
}: {
  owner: string;
  role: string;
  invoiceId: string;
  refreshAccess: () => void;
  accessBusy: boolean;
}) {
  const parse = useCallback(
      (v: unknown) => parseInvoiceDetail(v, invoiceId),
      [invoiceId],
    ),
    parsePaper = useCallback(
      (v: unknown) => parseStaffInvoiceDocument(v, invoiceId),
      [invoiceId],
    );
  const invoice = useResource(`/staff/invoices/${invoiceId}`, parse),
    document = useResource(`/staff/invoices/${invoiceId}/document`, parsePaper);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<InvoiceTransitionPending | undefined>(() =>
      readInvoiceTransitionPending(owner, role),
    ),
    [saved, setSaved] = useState<{ invoice: WorkInvoice; action: InvoiceAction }>(),
    [inspected, setInspected] = useState<WorkInvoice>(),
    [recovery, setRecovery] = useState<WorkInvoice>(),
    [message, setMessage] = useState<string>(),
    [unavailable, setUnavailable] = useState(false),
    [working, setWorking] = useState(false),
    [exportBusy, setExportBusy] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const active = useRef(true),
    flight = useRef(false),
    exportLock = useRef(false),
    request = useRef<AbortController | null>(null),
    focus = useRef<string | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const deny = useCallback(() => {
    redactInvoiceChanges();
    setUnavailable(true);
    setProposal(null);
    setSaved(undefined);
    setInspected(undefined);
    setRecovery(undefined);
    setMessage(undefined);
  }, []);
  useEffect(() => {
    if (invoice.denied || document.denied) {
      const timer = setTimeout(deny, 0);
      return () => clearTimeout(timer);
    }
  }, [invoice.denied, document.denied, deny]);
  useEffect(() => {
    if (proposal || unavailable || !focus.current) return;
    const timer = requestAnimationFrame(() => {
      const heading = window.document.getElementById(focus.current ?? "");
      focus.current = null;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(timer);
  }, [proposal, unavailable, saved, pending, recovery]);
  const blocked = unavailable || invoice.denied || document.denied;
  const candidates = [invoice.data, saved?.invoice, inspected].filter(
    (v): v is WorkInvoice => !!v,
  );
  const current = blocked
    ? undefined
    : candidates.reduce<WorkInvoice | undefined>(
        (latest, v) =>
          !latest ||
          v.version > latest.version ||
          (v.version === latest.version &&
            Date.parse(v.updatedAt) > Date.parse(latest.updatedAt))
            ? v
            : latest,
        undefined,
      );
  const paper = blocked ? undefined : document.data,
    matches = !!current && !!paper && invoiceDocumentMatches(current, paper);
  const invoiceError = invoice.error || invoice.refreshError,
    paperError = document.error || document.refreshError;
  const busy =
    working || exportBusy || invoice.loading || invoice.refreshing || accessBusy;
  const actionsDisabled = busy || !!proposal || !!pending || blocked || !!invoiceError;
  const exportDisabled =
    actionsDisabled ||
    !matches ||
    !!paperError ||
    document.loading ||
    document.refreshing;
  function refresh() {
    if (flight.current || exportLock.current || proposal) return;
    invoice.refresh();
    document.refresh();
  }
  const exportState = useCallback((value: boolean) => {
    exportLock.current = value;
    setExportBusy(value);
  }, []);
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Invoice account changed");
  }
  async function freshAccess(signal: AbortSignal) {
    const p = parseOwnStaffProfile((await apiRequest("/staff/profile", { signal })).data);
    identity(signal);
    if (p.id !== owner || p.role !== role || p.status !== "ACTIVE")
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
  }
  async function fresh(id: string, signal: AbortSignal) {
    await freshAccess(signal);
    const result = parseInvoiceDetail(
      (await apiRequest(`/staff/invoices/${id}`, { signal })).data,
      id,
    );
    identity(signal);
    return result;
  }
  function denied(error: unknown) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      deny();
      return true;
    }
    return false;
  }
  async function verifyExport(signal: AbortSignal) {
    if (!current || flight.current || pending || proposal || blocked)
      throw Error("Invoice export is unavailable");
    const verified = await fresh(invoiceId, signal);
    if (invoiceDetailSnapshot(verified) !== invoiceDetailSnapshot(current)) {
      setInspected(verified);
      document.refresh();
      throw Error(
        "The invoice changed. Refresh and review the current document before exporting.",
      );
    }
    if (!paper || !invoiceDocumentMatches(verified, paper))
      throw Error("The current invoice document could not be confirmed");
  }
  function review(action: InvoiceAction) {
    if (
      !current ||
      actionsDisabled ||
      flight.current ||
      exportLock.current ||
      !invoiceCanTransition(current, action)
    )
      return;
    setMessage(undefined);
    const change: InvoiceTransition = {
        invoice: current,
        action,
        body: { expectedVersion: current.version },
      },
      source = invoiceSource(current);
    setProposal({
      title: action === "issue" ? "Issue this invoice?" : "Void this invoice?",
      description:
        action === "issue"
          ? "The issued invoice becomes available to the customer. Issuing does not confirm or collect a payment."
          : "Voiding closes this invoice. It does not cancel its source order, booking or vehicle purchase, and it does not refund a payment. The server checks successful linked payments before allowing this action.",
      facts: [
        { label: "Invoice", value: current.invoiceNumber },
        { label: "Invoice reference", value: current.id },
        {
          label: "Source",
          value: `${invoiceSourceLabels[source.kind]} · ${source.reference}`,
        },
        { label: "Source reference", value: source.id },
        { label: "Branch", value: source.branch?.name ?? "Unassigned branch" },
        { label: "Invoice total", value: formatKobo(current.totalKobo) },
        { label: "Current status", value: invoiceStatusLabels[current.status] },
        { label: "Expected version", value: String(current.version) },
        {
          label: "Due date (Lagos)",
          value: current.dueAt ? formatStockInstant(current.dueAt) : "Not set",
        },
      ],
      retryAfterRejection: false,
      onUncertain: () => {
        setPending(readInvoiceTransitionPending(owner, role));
        focus.current = "invoice-transition-recovery-heading";
      },
      submit: async () => {
        if (flight.current || exportLock.current)
          throw new ApiError(409, {
            message: "An invoice operation is already in progress.",
          });
        flight.current = true;
        setWorking(true);
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        let sent = false,
          marker: Exclude<InvoiceTransitionPending, "unknown"> | undefined;
        try {
          const previous = readInvoiceTransitionPending(owner, role);
          if (previous) {
            setPending(previous);
            throw Error("A previous invoice change needs reconciliation.");
          }
          const verified = await fresh(invoiceId, controller.signal);
          if (
            invoiceDetailSnapshot(verified) !== invoiceDetailSnapshot(change.invoice) ||
            !invoiceCanTransition(verified, action)
          ) {
            setInspected(verified);
            setRecovery(verified);
            focus.current = "invoice-current-heading";
            throw Error(
              "The invoice changed. Review its current facts before proposing another action.",
            );
          }
          const fingerprint = await invoiceFingerprint(change.body);
          identity(controller.signal);
          marker = markInvoiceTransitionPending(owner, role, {
            invoiceId,
            action,
            expectedVersion: change.body.expectedVersion,
            fingerprint,
          });
          setPending(marker);
          sent = true;
          const result = await apiRequest(`/staff/invoices/${invoiceId}/${action}`, {
            method: "POST",
            body: change.body,
            csrf: true,
            signal: controller.signal,
          });
          identity(controller.signal);
          const confirmed = validateInvoiceTransition(result.data, change);
          clearInvoiceTransitionPending(owner, role, marker.token);
          setPending(undefined);
          setSaved({ invoice: confirmed, action });
          setRecovery(undefined);
          setInspected(confirmed);
          focus.current = "invoice-change-heading";
          invoice.refresh();
          document.refresh();
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
              clearInvoiceTransitionPending(owner, role, marker.token);
              setPending(undefined);
            }
            setMessage(
              !sent
                ? `No invoice change request was sent. ${error instanceof Error ? error.message : "Check the current invoice."}`
                : "The server rejected this change. Check the current invoice before reviewing another action.",
            );
            if (!sent)
              throw new ApiError(409, {
                message:
                  "No invoice change request was sent. Close the review and inspect the current invoice.",
              });
            throw error;
          }
          setPending(readInvoiceTransitionPending(owner, role));
          focus.current = "invoice-transition-recovery-heading";
          throw Error("The invoice change outcome could not be confirmed.");
        } finally {
          flight.current = false;
          if (active.current) setWorking(false);
        }
      },
    });
  }
  async function loadCurrent() {
    if (flight.current || exportLock.current || blocked) return;
    flight.current = true;
    setWorking(true);
    setMessage(undefined);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const id = pending && pending !== "unknown" ? pending.invoiceId : invoiceId;
    try {
      const verified = await fresh(id, controller.signal);
      if (id === invoiceId) {
        setInspected(verified);
        document.refresh();
      }
      setRecovery(verified);
      setAcknowledged(false);
      focus.current = "invoice-current-heading";
    } catch (error) {
      if (active.current && !denied(error))
        setMessage(
          "The current invoice could not be checked. The local recovery lock remains in place.",
        );
    } finally {
      flight.current = false;
      if (active.current) setWorking(false);
    }
  }
  function clearReconciled() {
    if (
      !recovery ||
      !acknowledged ||
      working ||
      blocked ||
      (pending && pending !== "unknown" && pending.invoiceId !== recovery.id)
    )
      return;
    try {
      clearInvoiceTransitionPending(
        owner,
        role,
        pending && pending !== "unknown" ? pending.token : undefined,
      );
      setPending(undefined);
      setRecovery(undefined);
      setAcknowledged(false);
      setMessage(
        "Local recovery lock cleared after your reconciliation. Any earlier server request is unaffected. Review a new action deliberately.",
      );
      requestAnimationFrame(() =>
        window.document.getElementById("invoice-handling-heading")?.focus(),
      );
    } catch {
      setMessage(
        "The local recovery lock could not be cleared. Keep the invoice reference and check again.",
      );
    }
  }
  const source = current ? invoiceSource(current) : undefined;
  return (
    <div className="work-inspections work-invoice-detail">
      <nav className="wid-breadcrumb" aria-label="Invoice breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/invoices">Invoices</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page" title={current?.invoiceNumber}>
              {current?.invoiceNumber ?? "Invoice details"}
            </span>
          </li>
        </ol>
      </nav>
      {current && !invoice.loading && !invoice.refreshing && !invoiceError && (
        <NotificationRecordContext resourceType="INVOICE" resourceId={current.id} />
      )}
      <header className="wid-heading">
        <div>
          <h1>{current?.invoiceNumber ?? "Invoice details"}</h1>
          {current && (
            <>
              <WorkflowProgress workflow="invoice" status={current.status} />
              <span
                className={`wid-status wid-status-${current.status.toLowerCase()}`}
                data-status={current.status}
              >
                {invoiceStatusLabels[current.status]}
              </span>
            </>
          )}
          <p>Review the source, document and recorded payments before issuing.</p>
        </div>
        <div className="wid-refresh">
          <button
            className="button secondary"
            disabled={busy || blocked || !!proposal}
            onClick={refresh}
          >
            <RefreshCw size={15} aria-hidden="true" />
            Refresh invoice
          </button>
          <button
            className="button secondary"
            disabled={working || exportBusy || accessBusy || !!proposal}
            onClick={refreshAccess}
          >
            Refresh invoice access
          </button>
        </div>
      </header>
      {blocked ? (
        <section className="wid-feedback">
          <h2>Invoice access is unavailable</h2>
          <Feedback message="Protected invoice and document information has been cleared. Refresh your access before continuing." />
          <Link className="text-link" href="/admin/invoices">
            Back to invoices
          </Link>
        </section>
      ) : (
        <>
          <Feedback message={invoiceError} />
          <Feedback message={message} />
          {(invoice.loading || invoice.refreshing) && (
            <p role="status">Checking invoice…</p>
          )}
          {invoiceError && current && (
            <p className="wid-notice">
              Previously loaded invoice facts are shown for reference. Refresh
              successfully before making a change or exporting.
            </p>
          )}
          {saved && (
            <section className="wid-result" aria-labelledby="invoice-change-heading">
              <h2 id="invoice-change-heading" tabIndex={-1}>
                {saved.action === "issue" ? "Invoice issued" : "Invoice voided"}
              </h2>
              <p>
                {saved.invoice.invoiceNumber} · Version {saved.invoice.version} ·{" "}
                {formatKobo(saved.invoice.totalKobo)}
              </p>
              <p>
                {saved.action === "issue"
                  ? "The invoice is available to the customer. This action did not collect a payment."
                  : "The invoice is void. This action did not cancel its source or refund a payment."}
              </p>
            </section>
          )}
          {pending && (
            <section
              className="wid-recovery"
              aria-labelledby="invoice-transition-recovery-heading"
            >
              <h2 id="invoice-transition-recovery-heading" tabIndex={-1}>
                Invoice change needs checking
              </h2>
              <p>
                The earlier request will not be sent again. Load current facts before
                independently reconciling the outcome.
              </p>
              {pending === "unknown" ? (
                <p>
                  The original reference was redacted or could not be restored. This page
                  can inspect its current invoice; that does not identify or prove the
                  earlier request.
                </p>
              ) : (
                <p>
                  {pending.action === "issue" ? "Issue" : "Void"} request · Expected
                  version {pending.expectedVersion}
                  <br />
                  <span className="wid-reference">{pending.invoiceId}</span>
                  {pending.invoiceId !== invoiceId && (
                    <>
                      <br />
                      <Link
                        className="text-link"
                        href={`/admin/invoices/${pending.invoiceId}`}
                      >
                        Open the invoice needing reconciliation
                      </Link>
                    </>
                  )}
                </p>
              )}
              <button
                className="button secondary"
                disabled={working || exportBusy || !!proposal}
                onClick={() => void loadCurrent()}
              >
                {working ? "Checking current invoice…" : "Load current invoice"}
              </button>
            </section>
          )}
          {recovery && (
            <section className="wid-result" aria-labelledby="invoice-current-heading">
              <h2 id="invoice-current-heading" tabIndex={-1}>
                Current invoice facts
              </h2>
              <p>
                {recovery.invoiceNumber} · {invoiceStatusLabels[recovery.status]} ·
                Version {recovery.version} · {formatKobo(recovery.totalKobo)}
              </p>
              <p className="wid-reference">Invoice reference: {recovery.id}</p>
              <p>
                This read shows current facts. It does not prove which request changed the
                invoice.
              </p>
              {pending && (
                <>
                  <label className="wid-ack">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    I have independently reconciled the earlier request and can clear its
                    local recovery lock.
                  </label>
                  <button
                    className="button secondary"
                    disabled={!acknowledged || working || exportBusy}
                    onClick={clearReconciled}
                  >
                    Clear reconciled lock
                  </button>
                </>
              )}
            </section>
          )}
          {!current && invoice.loading && (
            <section className="wid-loading">
              <FileText size={24} aria-hidden="true" />
              <p>Loading invoice details…</p>
              <div />
              <div />
            </section>
          )}
          {!current && !invoice.loading && invoiceError && (
            <section className="wid-feedback">
              <h2>Invoice details could not be loaded</h2>
              <p>Refresh to check this invoice again, or return to invoice records.</p>
              <Link className="text-link" href="/admin/invoices">
                Back to invoices
              </Link>
            </section>
          )}
          {current && source && (
            <>
              <div className="wid-layout">
                <aside className="wid-rail">
                  <section className="wid-value" aria-label="Invoice summary">
                    <span>Invoice value</span>
                    <strong>{formatKobo(current.totalKobo)}</strong>
                    <span>NGN · {invoiceStatusLabels[current.status]}</span>
                  </section>
                  <section className="wid-handling">
                    <h2 id="invoice-handling-heading" tabIndex={-1}>
                      Invoice handling
                    </h2>
                    <div className="wid-action-buttons">
                      {invoiceCanTransition(current, "issue") && (
                        <button
                          className="button"
                          disabled={actionsDisabled}
                          onClick={() => review("issue")}
                        >
                          Review invoice issue
                        </button>
                      )}
                      {invoiceCanTransition(current, "void") && (
                        <button
                          className="button secondary wid-void"
                          disabled={actionsDisabled}
                          onClick={() => review("void")}
                        >
                          Review invoice void
                        </button>
                      )}
                    </div>
                    <p>
                      {current.status === "DRAFT"
                        ? "Draft invoices are not visible to customers. Issuing makes this invoice available to the customer and does not collect a payment."
                        : current.status === "VOID"
                          ? "This invoice is void. Do not use it to make a payment."
                          : current.status === "PAID"
                            ? "Payment is recorded for this invoice. Invoice issue and void actions are unavailable."
                            : "Issuing does not collect a payment. A successful linked payment prevents voiding."}
                    </p>
                    {["DRAFT", "ISSUED"].includes(current.status) && (
                      <p className="field-hint">
                        Void does not cancel the source or refund money.
                      </p>
                    )}
                  </section>
                  <section className="wid-source">
                    <h2>Source and workshop</h2>
                    <span>{invoiceSourceLabels[source.kind]}</span>
                    <strong>{source.reference}</strong>
                    <p>{source.branch?.name ?? "Unassigned branch"}</p>
                    <Link className="text-link" href={source.href}>
                      {current.order
                        ? `View source order ${current.order.orderNumber}`
                        : current.booking
                          ? "View source booking"
                          : `Vehicle transaction: ${current.vehicleTransaction?.transactionNumber}`}
                    </Link>
                  </section>
                </aside>
                <div className="wid-document">
                  <Feedback message={paperError} />
                  {document.loading && <p role="status">Loading invoice document…</p>}
                  {document.refreshing && <p role="status">Checking invoice document…</p>}
                  {paper &&
                    (!matches ||
                      paperError ||
                      document.loading ||
                      document.refreshing) && (
                      <p className="wid-notice">
                        Previously loaded document. Its current version could not be
                        confirmed; export is unavailable until the invoice and document
                        match.
                      </p>
                    )}
                  {paper ? (
                    <StaffInvoicePaper
                      paper={paper}
                      branch={source.branch?.name ?? "Unassigned branch"}
                    />
                  ) : (
                    !document.loading && (
                      <section className="wid-paper-unavailable">
                        <FileText size={26} aria-hidden="true" />
                        <h2>Invoice document is unavailable</h2>
                        <p>
                          The invoice facts remain available. Refresh the document before
                          downloading or sharing.
                        </p>
                      </section>
                    )
                  )}
                  {(paperError || !matches) && !document.loading && (
                    <button
                      className="button secondary"
                      disabled={
                        document.refreshing || working || exportBusy || !!proposal
                      }
                      onClick={document.refresh}
                    >
                      Refresh invoice document
                    </button>
                  )}
                  <div className="wid-export">
                    <span>
                      {paper?.status === "DRAFT"
                        ? "Draft preview"
                        : "Private invoice document"}
                    </span>
                    <DocumentActions
                      key={`${invoiceId}:${current.version}:${current.status}`}
                      kind="invoice"
                      id={invoiceId}
                      disabled={exportDisabled}
                      staff={{
                        version: current.version,
                        status: current.status,
                        verify: verifyExport,
                        onDenied: deny,
                        onBusyChange: exportState,
                      }}
                    />
                  </div>
                </div>
                <StaffInvoiceLifecycle invoice={current} />
              </div>
              <section className="wid-payments">
                <div className="wid-section-heading">
                  <div>
                    <h2>Recorded payment requests</h2>
                    <p>
                      Requested amounts are not evidence of payment. No remaining balance
                      is calculated here.
                    </p>
                  </div>
                  <Link className="text-link" href="/admin/payments">
                    Open payment records
                  </Link>
                </div>
                {(matches && paper ? paper.paymentRequests : current.payments).length ? (
                  <ul>
                    {(matches && paper ? paper.paymentRequests : current.payments).map(
                      (p) => (
                        <li key={p.id}>
                          <div>
                            <h3>{p.paymentNumber}</h3>
                            <p>{p.status.replaceAll("_", " ")}</p>
                            <span className="wid-reference">{p.id}</span>
                          </div>
                          <div>
                            <strong>{formatKobo(p.amountKobo)}</strong>
                            <p>
                              {p.succeededAt
                                ? `Confirmed ${formatStockInstant(p.succeededAt)}`
                                : "Confirmation not recorded"}
                            </p>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <div className="wid-empty">
                    <FileText size={23} aria-hidden="true" />
                    <p>No payment requests are recorded for this invoice.</p>
                  </div>
                )}
                {matches && paper && (
                  <>
                    <h3>Confirmed receipt records</h3>
                    {paper.receipts.length ? (
                      <ul>
                        {paper.receipts.map((r) => (
                          <li key={r.paymentId}>
                            <div>
                              <strong>{r.paymentNumber}</strong>
                              <p>{formatStockInstant(r.confirmedAt)}</p>
                              <span className="wid-reference">{r.paymentId}</span>
                            </div>
                            <div>
                              <strong>{formatKobo(r.amountKobo)}</strong>
                              <p>Completed refunds: {formatKobo(r.refundedKobo)}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No eligible confirmed receipt records were returned.</p>
                    )}
                    <p className="field-hint">
                      The document may include verified payments associated with its
                      source. Payment requests and receipts remain separate records.
                    </p>
                  </>
                )}
              </section>
              <details className="wid-metadata">
                <summary>Full references and metadata</summary>
                <dl>
                  <div>
                    <dt>Invoice reference</dt>
                    <dd>{current.id}</dd>
                  </div>
                  <div>
                    <dt>Source reference</dt>
                    <dd>{source.id}</dd>
                  </div>
                  <div>
                    <dt>Source status</dt>
                    <dd>
                      {
                        (current.order ?? current.booking ?? current.vehicleTransaction)
                          ?.status
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>Branch reference</dt>
                    <dd>{source.branch?.id ?? "Unassigned"}</dd>
                  </div>
                  <div>
                    <dt>Branch code</dt>
                    <dd>{source.branch?.code ?? "Unassigned"}</dd>
                  </div>
                  {paper && (
                    <div>
                      <dt>Bill-to account reference</dt>
                      <dd>{paper.billTo.reference}</dd>
                    </div>
                  )}
                </dl>
              </details>
            </>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => undefined}
          exposeBusyState
          confirmLabel="Confirm change"
        />
      )}
    </div>
  );
}
