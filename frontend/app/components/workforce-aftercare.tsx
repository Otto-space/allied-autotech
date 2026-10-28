"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseWorkforceAccess, type WorkforceAccess } from "@/lib/api/workforce-schemas";
import { sameWorkforceScope } from "@/lib/admin/workforce-overview";
import { workforceAllows, workforceActionPredicates } from "@/lib/workforce-registry";
import {
  parseWorkforceAftercarePage,
  parseWorkforceAftercare,
  parseAftercareDecisionReceipt,
  workforceAftercareQuery,
  aftercareHref,
  aftercarePageParams,
  aftercareLabels,
  aftercareKinds,
  aftercareLabel,
  aftercareDecisionSchema,
  type WorkforceAftercare,
} from "@/lib/admin/workforce-aftercare";
import {
  readAftercarePending,
  markAftercarePending,
  clearAftercarePending,
  type WorkforceAftercarePending,
} from "@/lib/admin/workforce-aftercare-pending";
import { nairaToKobo } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import "./workforce-complaints.css";
import "./workforce-finance.css";
import "./workforce-aftercare.css";

type Props = { access: WorkforceAccess; refreshAccess: () => void };
export function WorkforceAftercare({
  access,
  refreshAccess,
  id,
}: { id?: string } & Props) {
  return id ? (
    <AftercareDetail key={id} id={id} access={access} refreshAccess={refreshAccess} />
  ) : (
    <AftercareQueue access={access} refreshAccess={refreshAccess} />
  );
}
function AftercareQueue({ access, refreshAccess }: Props) {
  const search = useSearchParams(),
    router = useRouter();
  const query = workforceAftercareQuery(new URLSearchParams(search.toString()));
  const resource = useResource(query.path, parseWorkforceAftercarePage);
  const busy = resource.loading || resource.refreshing;
  const error =
    resource.error ||
    resource.refreshError ||
    (resource.data && !sameWorkforceScope(access, resource.data.access)
      ? "Your finance responsibilities changed. Refresh access before continuing."
      : undefined);
  const data = !busy && !error && !query.invalid ? resource.data : undefined;
  const first = new URLSearchParams(query.params);
  first.delete("cursor");
  first.delete("_trail");
  const navigate = (params: URLSearchParams) =>
    router.push(aftercareHref(params), { scroll: false });
  return (
    <div className="workforce-complaints workforce-finance workforce-aftercare">
      <header className="wfc-heading">
        <div>
          <h1>Financial aftercare</h1>
          <p>
            Review return and cancellation decisions within your finance responsibilities.
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy || query.invalid}
          onClick={() => {
            refreshAccess();
            resource.refresh();
          }}
        >
          Refresh requests
        </button>
      </header>
      <p>
        Both finance access and a separate financial approval permission are required.
        This workspace records decisions; refunds and stock adjustments have their own
        controls.
      </p>
      <form
        key={search.toString()}
        className="wfc-filters"
        aria-label="Filter aftercare requests"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget),
            params = new URLSearchParams();
          for (const key of ["q", "kind", "status"]) {
            const value = String(form.get(key) ?? "").trim();
            if (value) params.set(key, value);
          }
          navigate(params);
          if (params.toString() === query.params.toString()) resource.refresh();
        }}
      >
        <div className="field">
          <label htmlFor="wfa-search">Order reference</label>
          <input
            id="wfa-search"
            name="q"
            maxLength={120}
            defaultValue={query.params.get("q") ?? ""}
          />
        </div>
        <div className="field">
          <label htmlFor="wfa-kind">Request type</label>
          <select id="wfa-kind" name="kind" defaultValue={query.params.get("kind") ?? ""}>
            <option value="">All types</option>
            {Object.entries(aftercareKinds).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="wfa-status">Request status</label>
          <select
            id="wfa-status"
            name="status"
            defaultValue={query.params.get("status") ?? ""}
          >
            <option value="">All statuses</option>
            {Object.entries(aftercareLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="wfc-filter-actions">
          <button className="button">Apply filters</button>
          <Link className="button secondary" href="/admin/workforce/aftercare">
            Clear filters
          </Link>
        </div>
      </form>
      <Feedback
        message={
          query.invalid
            ? "This filter link is invalid. Clear filters and use the controls above."
            : error
        }
      />
      <section className="wfc-results" aria-labelledby="wfa-results">
        <header>
          <h2 id="wfa-results">Permitted requests</h2>
        </header>
        {busy && (
          <p className="wfc-state" role="status">
            Checking current requests…
          </p>
        )}
        {data && data.items.length > 0 ? (
          <table>
            <caption className="sr-only">
              Return and cancellation requests within your finance scope
            </caption>
            <thead>
              <tr>
                {["Order", "Request", "Branch", "Status", "Requested", "Open"].map(
                  (label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.order.orderNumber}</th>
                  <td data-label="Request">{aftercareLabel(aftercareKinds, row.kind)}</td>
                  <td data-label="Branch">{row.order.branch.name}</td>
                  <td data-label="Status">
                    {aftercareLabel(aftercareLabels, row.status)}
                  </td>
                  <td data-label="Requested">
                    <time dateTime={row.requestedAt}>
                      {formatBusinessDate(row.requestedAt)}
                    </time>
                  </td>
                  <td data-label="Open">
                    <Link
                      className="button secondary"
                      href={`/admin/workforce/aftercare/${row.id}`}
                      aria-label={`Review request for ${row.order.orderNumber}`}
                    >
                      Review request
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          data && (
            <div className="wfc-state">
              <h3>No requests match your current scope and filters</h3>
              <p>
                Clear or adjust filters. No request is created when you open this
                workspace.
              </p>
            </div>
          )
        )}
        {data && (
          <footer>
            <p role="status">{data.items.length} requests on this page</p>
            <nav aria-label="Aftercare pages">
              <button
                className="button secondary"
                disabled={!query.params.has("cursor")}
                onClick={() =>
                  navigate(aftercarePageParams(query.params, undefined, true))
                }
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={!query.params.has("cursor")}
                onClick={() => navigate(first)}
              >
                First page
              </button>
              <button
                className="button secondary"
                disabled={
                  !data.nextCursor ||
                  (query.params.get("_trail")?.split(",").length ?? 0) >= 50
                }
                onClick={() =>
                  navigate(aftercarePageParams(query.params, data.nextCursor))
                }
              >
                Next
              </button>
            </nav>
          </footer>
        )}
      </section>
    </div>
  );
}
function noDecisionSent() {
  const error = new ApiError(409, { error: { code: "CONFLICT" } });
  error.message =
    "No decision was sent. Refresh the request and permissions, then review the current evidence.";
  return error;
}
function AftercareDetail({ id, access, refreshAccess }: Props & { id: string }) {
  const parse = useCallback((value: unknown) => parseWorkforceAftercare(value, id), [id]);
  const resource = useResource(`/staff/workforce/aftercare/${id}`, parse);
  const [note, setNote] = useState(""),
    [fee, setFee] = useState(""),
    [stage, setStage] = useState<"APPROVED" | "REJECTED" | "">("");
  const [error, setError] = useState<string>(),
    [message, setMessage] = useState<string>(),
    [expectedAfter, setExpectedAfter] = useState<string>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [pending, setPending] = useState<WorkforceAftercarePending>(),
    [ready, setReady] = useState(false);
  const [inspected, setInspected] = useState<WorkforceAftercare>(),
    [reviewed, setReviewed] = useState(false),
    [checking, setChecking] = useState(false);
  const active = useRef(true),
    request = useRef<AbortController | null>(null),
    saved = useRef<ReturnType<typeof parseAftercareDecisionReceipt> | undefined>(
      undefined,
    );
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => {
      if (active.current) {
        setPending(readAftercarePending(access.userId));
        setReady(true);
      }
    });
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, [access.userId]);
  const busy = resource.loading || resource.refreshing;
  const failure =
    resource.error ||
    resource.refreshError ||
    (resource.data && !sameWorkforceScope(access, resource.data.access)
      ? "Current finance access could not be verified. Refresh permissions."
      : undefined);
  const row =
    !busy && !failure && (!expectedAfter || resource.data?.status === expectedAfter)
      ? resource.data
      : undefined;
  async function current() {
    const controller = new AbortController();
    request.current = controller;
    const [ownResponse, detailResponse] = await Promise.all([
      apiRequest("/staff/workforce/access", { signal: controller.signal }),
      apiRequest(`/staff/workforce/aftercare/${id}`, { signal: controller.signal }),
    ]);
    if (!active.current) throw noDecisionSent();
    const own = parseWorkforceAccess(ownResponse.data),
      detail = parse(detailResponse.data);
    if (
      !sameWorkforceScope(access, own) ||
      !sameWorkforceScope(own, detail.access) ||
      !workforceAllows(own, workforceActionPredicates.financialAftercare, {
        branchId: detail.order.branchId,
      })
    )
      throw noDecisionSent();
    return { detail, signal: controller.signal };
  }
  function review() {
    if (!row || !ready || pending || proposal || !row.reviewEvidenceReady || !stage)
      return;
    let amount: string | undefined;
    try {
      if (stage === "APPROVED") {
        amount = nairaToKobo(fee);
        if (
          amount.length > 18 ||
          BigInt(amount) > BigInt(row.order.totalKobo) ||
          (row.kind === "CANCELLATION" &&
            row.order.confirmedAt === null &&
            amount !== "0")
        )
          throw Error();
      }
    } catch {
      setError(
        "Enter an explicit fee within the order total, including zero. Cancellation before confirmation is free.",
      );
      document.getElementById("wfa-fee")?.focus();
      return;
    }
    const parsed = aftercareDecisionSchema.safeParse({
      stage,
      note,
      expectedStatus: row.status,
      expectedRevision: row.reviewRevision,
      ...(amount !== undefined ? { approvedFeeKobo: amount } : {}),
    });
    if (!parsed.success) {
      setError("Write the customer-visible decision note in 20–2,000 characters.");
      document.getElementById("wfa-note")?.focus();
      return;
    }
    const input = parsed.data,
      before = row;
    setError(undefined);
    saved.current = undefined;
    setProposal({
      title: "Record this financial decision?",
      description:
        "The decision and note are visible to the customer. This records a review only: it does not cancel the order, restock goods, initiate a refund or mark money received.",
      facts: [
        { label: "Order", value: row.order.orderNumber },
        { label: "Branch", value: row.order.branch.name },
        { label: "Request", value: aftercareLabel(aftercareKinds, row.kind) },
        { label: "Decision", value: aftercareLabel(aftercareLabels, input.stage) },
        ...(amount !== undefined
          ? [{ label: "Reviewed fee", value: formatKobo(amount) }]
          : []),
        { label: "Audience", value: "Customer-visible decision note" },
        { label: "Note", value: input.note },
      ],
      retryAfterRejection: false,
      submit: async () => {
        let sent = false,
          marker: ReturnType<typeof markAftercarePending> | undefined;
        try {
          const fresh = await current();
          if (
            fresh.detail.reviewRevision !== before.reviewRevision ||
            fresh.detail.status !== before.status ||
            !fresh.detail.reviewEvidenceReady
          )
            throw noDecisionSent();
          marker = markAftercarePending(access.userId, id);
          setPending(marker);
          if (!active.current || fresh.signal.aborted) throw noDecisionSent();
          sent = true;
          const response = await apiRequest(`/staff/workforce/aftercare/${id}/decision`, {
            method: "POST",
            csrf: true,
            body: input,
            signal: fresh.signal,
          });
          const receipt = parseAftercareDecisionReceipt(
            response.data,
            before,
            access.userId,
            input,
          );
          if (!active.current) return;
          clearAftercarePending(access.userId, marker.token);
          setPending(undefined);
          saved.current = receipt;
        } catch (caught) {
          if (!active.current) throw caught;
          const rejected =
            caught instanceof ApiError &&
            caught.status >= 400 &&
            caught.status < 500 &&
            ![408, 429].includes(caught.status);
          if (!sent || rejected) {
            if (marker) {
              clearAftercarePending(access.userId, marker.token);
              setPending(undefined);
            }
            if (!sent) throw noDecisionSent();
          } else setPending(readAftercarePending(access.userId) ?? "unknown");
          throw caught;
        }
      },
      onUncertain: () => setPending(readAftercarePending(access.userId) ?? "unknown"),
    });
  }
  async function inspect() {
    if (checking || !pending || (pending !== "unknown" && pending.id !== id)) return;
    setChecking(true);
    setError(undefined);
    setInspected(undefined);
    setReviewed(false);
    try {
      const fresh = await current();
      if (active.current) setInspected(fresh.detail);
    } catch {
      if (active.current)
        setError(
          "The current request could not be checked. Keep the decision blocked and refresh access.",
        );
    } finally {
      if (active.current) setChecking(false);
    }
  }
  function acknowledge() {
    if (!pending || !inspected || !reviewed || checking) return;
    try {
      clearAftercarePending(
        access.userId,
        pending === "unknown" ? undefined : pending.token,
      );
      setPending(undefined);
      setInspected(undefined);
      setReviewed(false);
      setNote("");
      setFee("");
      setStage("");
      resource.refresh();
    } catch {
      setError(
        "The recovery state changed or could not be cleared. Refresh before continuing.",
      );
    }
  }
  const terminal = row && ["APPROVED", "REJECTED"].includes(row.status);
  const canApprove = row?.kind === "CANCELLATION" || row?.status === "INSPECTED";
  return (
    <div className="workforce-complaints workforce-aftercare wfa-detail">
      <Link className="button secondary" href="/admin/workforce/aftercare">
        All permitted requests
      </Link>
      <header className="wfc-heading">
        <h1>Financial aftercare review</h1>
        <button
          className="button secondary"
          disabled={busy || !!proposal}
          onClick={() => {
            resource.refresh();
            refreshAccess();
          }}
        >
          Refresh request
        </button>
      </header>
      <Feedback message={failure || error} />
      <Feedback message={message} tone="success" />
      {busy && <p role="status">Checking current request and finance scope…</p>}
      {row && (
        <>
          <section className="card" aria-labelledby="wfa-request-heading">
            <h2 id="wfa-request-heading">{aftercareLabel(aftercareKinds, row.kind)}</h2>
            <dl className="wfa-facts">
              <dt>Order</dt>
              <dd>{row.order.orderNumber}</dd>
              <dt>Branch</dt>
              <dd>{row.order.branch.name}</dd>
              <dt>Status</dt>
              <dd>{aftercareLabel(aftercareLabels, row.status)}</dd>
              <dt>Order total</dt>
              <dd>{formatKobo(row.order.totalKobo)}</dd>
              <dt>Requested</dt>
              <dd>{formatBusinessDate(row.requestedAt)}</dd>
              <dt>Order confirmed</dt>
              <dd>
                {row.order.confirmedAt
                  ? formatBusinessDate(row.order.confirmedAt)
                  : "Not confirmed"}
              </dd>
            </dl>
            <h3>Customer’s request</h3>
            <p className="wfa-note">{row.reason}</p>
            <h3>Requested items</h3>
            {row.requestedItems ? (
              <ul>
                {row.requestedItems.map((item) => (
                  <li key={item.orderItemId}>
                    {item.productName} — {item.quantity} of {item.orderedQuantity} ordered
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status">
                The stored item evidence could not be verified. An authorised operator
                must review it before a decision.
              </p>
            )}
          </section>
          <section className="card" aria-labelledby="wfa-evidence-heading">
            <h2 id="wfa-evidence-heading">Inspection and policy evidence</h2>
            <dl className="wfa-facts">
              <dt>Inspection</dt>
              <dd>
                {row.inspectedAt ? formatBusinessDate(row.inspectedAt) : "Not recorded"}
              </dd>
              <dt>Good condition</dt>
              <dd>
                {row.goodCondition === null
                  ? "Not recorded"
                  : row.goodCondition
                    ? "Yes"
                    : "No"}
              </dd>
            </dl>
            <h3>Internal inspection note</h3>
            <p className="wfa-note">{row.inspectionNote ?? "Not recorded"}</p>
            {row.policy ? (
              <>
                <h3>Stored policy evidence</h3>
                <p>
                  {row.policy.key}, version {row.policy.version} —{" "}
                  {row.policy.approvalStatus}
                </p>
                <p className="wfa-note">{row.policy.source}</p>
                <p>
                  Effective {formatBusinessDate(row.policy.effectiveAt)}. This identifies
                  the stored policy; it does not calculate or authorise a fee
                  automatically. Verify its approved monetary basis with the policy owner
                  if unclear.
                </p>
              </>
            ) : (
              <p role="status">
                Stored policy evidence is unavailable or unrecognised. Ask an authorised
                policy owner to review the missing evidence.
              </p>
            )}
          </section>
          <section className="card" aria-labelledby="wfa-decision-heading">
            <h2 id="wfa-decision-heading">Financial decision</h2>
            {pending ? (
              <>
                <p role="status">
                  An earlier financial decision needs checking. No automatic retry will be
                  sent.
                </p>
                {pending !== "unknown" && pending.id !== id ? (
                  <Link
                    className="text-link"
                    href={`/admin/workforce/aftercare/${pending.id}`}
                  >
                    Inspect the earlier request
                  </Link>
                ) : (
                  <>
                    {pending === "unknown" && (
                      <p>
                        The earlier reference is unavailable. Ask an authorised operator
                        to inspect the earlier history; this page alone cannot identify
                        that request.
                      </p>
                    )}
                    <button
                      className="button secondary"
                      disabled={checking}
                      onClick={() => void inspect()}
                    >
                      Check current request
                    </button>
                    {inspected && (
                      <>
                        <p>
                          Current request status:{" "}
                          {aftercareLabel(aftercareLabels, inspected.status)}. This does
                          not attribute an earlier uncertain submission.
                        </p>
                        <label className="wfa-checkbox">
                          <input
                            type="checkbox"
                            checked={reviewed}
                            onChange={(event) => setReviewed(event.target.checked)}
                          />
                          I have checked this record and the earlier decision history with
                          an authorised operator.
                        </label>
                        <button
                          className="button secondary"
                          disabled={!reviewed || checking}
                          onClick={acknowledge}
                        >
                          Acknowledge inspected state
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : terminal ? (
              <>
                <p>This request has a recorded financial decision.</p>
                <p>
                  Customer-visible note:{" "}
                  <span className="wfa-note">{row.reviewNote ?? "Not recorded"}</span>
                </p>
                <p>
                  Reviewed fee:{" "}
                  {row.approvedFeeKobo === null
                    ? "Not recorded"
                    : formatKobo(row.approvedFeeKobo)}
                </p>
                <p>
                  This does not establish that a refund was paid or stock was changed.
                </p>
              </>
            ) : !row.reviewEvidenceReady ? (
              <p>
                Missing or unrecognised evidence must be reviewed by an authorised
                operator before a financial decision.
              </p>
            ) : (
              <form
                className="wfa-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  review();
                }}
              >
                {!canApprove && (
                  <p>
                    A return must be received and inspected before approval. Those
                    operational checks require their own authorised workflow; rejection
                    remains a separate financial decision.
                  </p>
                )}
                <div className="field">
                  <label htmlFor="wfa-decision">Decision</label>
                  <select
                    id="wfa-decision"
                    value={stage}
                    required
                    disabled={!ready || !!proposal}
                    onChange={(event) => setStage(event.target.value as typeof stage)}
                  >
                    <option value="">Choose a decision</option>
                    {canApprove && <option value="APPROVED">Approve request</option>}
                    <option value="REJECTED">Reject request</option>
                  </select>
                </div>
                {stage === "APPROVED" && (
                  <div className="field">
                    <label htmlFor="wfa-fee">Reviewed fee (₦)</label>
                    <input
                      id="wfa-fee"
                      inputMode="decimal"
                      value={fee}
                      onChange={(event) => setFee(event.target.value)}
                      required
                      disabled={!!proposal}
                      aria-describedby="wfa-fee-hint"
                    />
                    <small id="wfa-fee-hint">
                      Enter the reviewed amount explicitly, including 0. Cancellation
                      before order confirmation is free.
                    </small>
                  </div>
                )}
                <div className="field">
                  <label htmlFor="wfa-note">Customer-visible decision note</label>
                  <textarea
                    id="wfa-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    minLength={20}
                    maxLength={2000}
                    rows={5}
                    required
                    disabled={!!proposal}
                    aria-describedby="wfa-note-audience"
                  />
                  <small id="wfa-note-audience">
                    The customer can read this note. Explain the decision and fee basis;
                    do not copy internal inspection notes or private financial details.
                  </small>
                </div>
                <button className="button" disabled={!ready || !!proposal}>
                  Review financial decision
                </button>
              </form>
            )}
          </section>
        </>
      )}
      {proposal && row && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Record financial decision"
          onClose={() => setProposal(null)}
          onSuccess={() => {
            if (saved.current) {
              setProposal(null);
              setExpectedAfter(saved.current.status);
              setMessage(
                "Financial decision recorded. Refund and stock workflows remain separate.",
              );
              setNote("");
              setFee("");
              setStage("");
              resource.refresh();
            }
          }}
        />
      )}
    </div>
  );
}
