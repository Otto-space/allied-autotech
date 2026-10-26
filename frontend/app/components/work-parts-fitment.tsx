"use client";

import "../admin/fitment/fitment.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  canEditFitment,
  canReviewFitment,
  fitmentAccountLabel,
  parseFitmentAccess,
  parseFitmentHistory,
  parseFitmentProduct,
  parseFitmentProducts,
  parseFitmentRule,
  parseFitmentRules,
  reviewStates,
  staffFitmentQuery,
  type FitmentAccess,
  type StaffFitmentRule,
} from "@/lib/admin/parts-fitment";
import {
  fitmentLabels,
  fitmentQualifierKeys,
  parseFitmentModel,
  type FitmentOption,
} from "@/lib/parts-fitment";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { FitmentCataloguePicker } from "./fitment-catalogue-picker";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { useEditorLeaveGuard } from "./use-editor-leave-guard";
import {
  evidenceGaps,
  fitmentYears,
  nonCriticalFitmentTypes,
  primaryFitmentQualifiers,
} from "@/lib/admin/fitment-presentation";

const base = "/staff/fitment";
const statusLabel = (value: string) =>
  value === "PENDING"
    ? "Pending review"
    : value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
function navigate(query: URLSearchParams) {
  window.history.pushState(null, "", `/admin/fitment${query.size ? `?${query}` : ""}`);
  requestAnimationFrame(() => document.getElementById("fitment-title")?.focus());
}

export function WorkPartsFitment() {
  const session = useAccountSession();
  if (!session) return null;
  return (
    <FitmentWorkspace
      key={`${session.user.id}:${session.user.role}`}
      userId={session.user.id}
    />
  );
}

function FitmentWorkspace({ userId }: { userId: string }) {
  const search = useSearchParams();
  const query = staffFitmentQuery(new URLSearchParams(search.toString()));
  const access = useResource(`${base}/access`, parseFitmentAccess);
  const permitted = !!access.data && !access.error && !access.refreshError;
  const product = useResource(
    permitted && !query.invalid && query.productId
      ? `${base}/products/${query.productId}`
      : null,
    parseFitmentProduct,
  );
  const record = useResource(
    permitted && !query.invalid && query.productId && query.ruleId
      ? `${base}/products/${query.productId}/rules/${query.ruleId}`
      : null,
    parseFitmentRule,
  );
  const list = useResource(
    permitted && !query.invalid && !query.ruleId && !query.creating
      ? `${base}/rules?${query.api}`
      : null,
    parseFitmentRules,
  );
  const [message, setMessage] = useState("");
  const selectedRule =
    record.data?.id === query.ruleId &&
    record.data.productId === query.productId &&
    !record.error
      ? record.data
      : undefined;
  const selectedProduct =
    product.data?.id === query.productId && !product.error ? product.data : undefined;
  const blocked =
    access.loading ||
    access.refreshing ||
    record.loading ||
    record.refreshing ||
    product.loading ||
    product.refreshing ||
    !!record.refreshError ||
    !!product.refreshError;
  function refresh() {
    access.revalidate();
    product.revalidate();
    record.revalidate();
    list.revalidate();
  }
  function openProduct(productId: string) {
    setMessage("");
    navigate(new URLSearchParams({ productId }));
  }
  function openRule(rule: StaffFitmentRule) {
    setMessage("");
    navigate(new URLSearchParams({ productId: rule.productId, ruleId: rule.id }));
  }
  return (
    <div className="fitment-workspace">
      <header>
        <p className="eyebrow">Parts catalogue</p>
        <h1 id="fitment-title" tabIndex={-1}>
          Vehicle compatibility
        </h1>
        <p>
          Choose a part, record its application and evidence, then obtain independent
          review.
        </p>
        <button type="button" className="button secondary" onClick={refresh}>
          Refresh fitment workspace
        </button>
      </header>
      <Feedback message={message} tone="success" />
      <Feedback message={access.error || access.refreshError} />
      {access.loading && (
        <p role="status">Checking current responsibility and branch access...</p>
      )}
      {query.invalid && (
        <>
          <Feedback message="This fitment link has invalid or conflicting filters. Open the workspace to start again." />
          <Link href="/admin/fitment" className="button secondary">
            Open fitment workspace
          </Link>
        </>
      )}
      {permitted && !query.invalid && access.data && (
        <>
          <details className="fitment-access">
            <summary>Your access and review safeguards</summary>
            <p>
              {access.data.canAuthor
                ? "Your Sales / Operations responsibilities allow authoring within the permitted branches. "
                : "Your Workshop / Quality responsibilities allow technical review. "}
              An author or last editor cannot approve their own rule. Only approved rules
              appear in customer fitment results. Reading or reviewing a rule does not
              reserve stock.
            </p>
          </details>
          {query.productId ? (
            <section aria-label="Selected part">
              <Feedback message={product.error || product.refreshError} />
              {product.loading && <p role="status">Loading selected part...</p>}
              {selectedProduct && (
                <>
                  <h2>{selectedProduct.name}</h2>
                  <p>
                    SKU {selectedProduct.sku} · Type:{" "}
                    {selectedProduct.productType || "Not recorded"}
                    {!selectedProduct.isActive ? " · Unpublished product" : ""}
                  </p>
                  {(access.data.globalAuthor || access.data.globalReviewer) && (
                    <Link
                      href={`/admin/products?media=${selectedProduct.id}`}
                      className="text-link"
                    >
                      Manage this product&apos;s images
                    </Link>
                  )}
                </>
              )}
              <Link href="/admin/fitment" className="text-link">
                Choose another part or view the review queue
              </Link>
            </section>
          ) : (
            <>
              <nav className="fitment-toolbar" aria-label="Compatibility workspace tasks">
                <a href="#fitment-part-picker">Choose product</a>
                <a href="#fitment-queue">Review queue</a>
                {access.data.canAuthor && (
                  <a href="#fitment-catalogue">Vehicle catalogue</a>
                )}
              </nav>
              <PartSelector onSelect={openProduct} />
            </>
          )}
          {query.ruleId ? (
            <>
              <Feedback message={record.error || record.refreshError} />
              {record.data &&
                (record.data.id !== query.ruleId ||
                  record.data.productId !== query.productId) && (
                  <Feedback message="The returned rule does not match this product link. Reopen the product and select its rule again." />
                )}
              {record.loading && <p role="status">Loading fitment rule...</p>}
              {selectedRule && selectedProduct && (
                <RuleDetail
                  key={selectedRule.id}
                  rule={selectedRule}
                  access={access.data}
                  userId={userId}
                  productType={selectedProduct.productType}
                  blocked={blocked}
                  onSaved={(text) => {
                    setMessage(text);
                    refresh();
                  }}
                />
              )}
              <Link
                className="button secondary"
                href={`/admin/fitment?${new URLSearchParams({ productId: query.productId! })}`}
              >
                Back to this part&apos;s rules
              </Link>
            </>
          ) : query.creating ? (
            selectedProduct &&
            access.data.canAuthor && (
              <RuleEditor
                key={selectedProduct.id}
                productId={selectedProduct.id}
                productType={selectedProduct.productType}
                access={access.data}
                userId={userId}
                blocked={blocked}
                onSaved={(id) => {
                  navigate(
                    new URLSearchParams({ productId: selectedProduct.id, ruleId: id }),
                  );
                  setMessage(
                    "Fitment draft saved. It is not published until an independent review approves it.",
                  );
                  refresh();
                }}
              />
            )
          ) : (
            <>
              <h2 id="fitment-queue">
                {selectedProduct ? "Product rules" : "Review queue"}
              </h2>
              <form
                className="fitment-toolbar"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = new URLSearchParams(query.params);
                  const state = new FormData(event.currentTarget).get("reviewStatus");
                  next.delete("cursor");
                  if (state) next.set("reviewStatus", String(state));
                  else next.delete("reviewStatus");
                  navigate(next);
                }}
              >
                <div className="field">
                  <label htmlFor="fitment-review-filter">Review state</label>
                  <select
                    id="fitment-review-filter"
                    name="reviewStatus"
                    defaultValue={query.params.get("reviewStatus") || ""}
                    key={query.params.get("reviewStatus") || "all"}
                  >
                    <option value="">All review states</option>
                    {reviewStates.map((state) => (
                      <option key={state} value={state}>
                        {statusLabel(state)}
                      </option>
                    ))}
                  </select>
                </div>
                <button className="button secondary">Apply review filter</button>
                {selectedProduct && access.data.canAuthor && (
                  <Link
                    href={`/admin/fitment?${new URLSearchParams({ productId: selectedProduct.id, view: "create" })}`}
                    className="button"
                  >
                    Add fitment rule
                  </Link>
                )}
              </form>
              <Feedback message={list.error || list.refreshError} />
              {list.loading ? (
                <p role="status">Loading permitted fitment rules...</p>
              ) : (
                list.data &&
                !list.error && (
                  <>
                    <p role="status">{list.data.items.length} rules on this page.</p>
                    {!list.data.items.length && (
                      <p>
                        No fitment rules match these filters. This does not establish
                        compatibility.
                      </p>
                    )}
                    <ul className="fitment-rule-list">
                      {list.data.items.map((rule) => (
                        <li key={rule.id} className="fitment-rule-card">
                          <span className="fitment-state" data-state={rule.reviewStatus}>
                            {statusLabel(rule.reviewStatus)}
                          </span>
                          <h2>{rule.product.name}</h2>
                          <p>
                            {rule.product.sku} ·{" "}
                            {rule.scope === "UNIVERSAL"
                              ? "Universal accessory"
                              : `${rule.make} ${rule.model || "(model not normalized)"} · ${fitmentYears(rule.yearFrom, rule.yearTo)}`}
                          </p>
                          <p>
                            {rule.effect === "EXCLUDE"
                              ? "Explicit exclusion"
                              : "Fitment inclusion"}{" "}
                            · Version {rule.version}
                          </p>
                          <p className="fitment-readiness">
                            {evidenceGaps(rule).length
                              ? `${evidenceGaps(rule).length} evidence checks need attention`
                              : "Evidence fields complete · approval is separate"}
                          </p>
                          <button
                            className="button secondary"
                            onClick={() => openRule(rule)}
                          >
                            View evidence and review {rule.product.sku}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="actions">
                      {query.params.has("cursor") && (
                        <button
                          className="button secondary"
                          onClick={() => {
                            const next = new URLSearchParams(query.params);
                            next.delete("cursor");
                            navigate(next);
                          }}
                        >
                          First page
                        </button>
                      )}
                      {list.data.nextCursor && (
                        <button
                          className="button secondary"
                          onClick={() => {
                            const next = new URLSearchParams(query.params);
                            next.set("cursor", list.data!.nextCursor!);
                            navigate(next);
                          }}
                        >
                          Next rules
                        </button>
                      )}
                    </div>
                  </>
                )
              )}
            </>
          )}
          {access.data.canAuthor && !query.ruleId && !query.creating && (
            <RegistryEditor onSaved={refresh} />
          )}
        </>
      )}
    </div>
  );
}

function PartSelector({ onSelect }: { onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState("");
  const params = new URLSearchParams({ limit: "25" });
  if (search) params.set("search", search);
  if (cursor) params.set("cursor", cursor);
  const products = useResource(`${base}/products?${params}`, parseFitmentProducts);
  return (
    <section className="fitment-rule-card" aria-labelledby="fitment-part-picker">
      <h2 id="fitment-part-picker">Choose a part</h2>
      <form
        className="fitment-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(String(new FormData(event.currentTarget).get("search") || "").trim());
          setCursor("");
        }}
      >
        <div className="field">
          <label htmlFor="fitment-product-search">Part name or SKU</label>
          <input
            id="fitment-product-search"
            name="search"
            maxLength={100}
            type="search"
          />
        </div>
        <button className="button secondary">Search permitted parts</button>
      </form>
      <Feedback message={products.error} />
      {products.loading && <p role="status">Loading parts in your current scope...</p>}
      {products.data && !products.error && (
        <>
          <ul className="fitment-product-results">
            {products.data.items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="fitment-product-choice"
                  onClick={() => onSelect(row.id)}
                >
                  {row.name} · {row.sku}
                  {!row.isActive ? " (unpublished)" : ""}
                </button>
              </li>
            ))}
          </ul>
          {!products.data.items.length && <p>No permitted parts match this search.</p>}
          {products.data.nextCursor && (
            <button
              className="button secondary"
              disabled={products.loading}
              onClick={() => setCursor(products.data!.nextCursor!)}
            >
              More parts
            </button>
          )}
          {cursor && (
            <button className="button secondary" onClick={() => setCursor("")}>
              First parts page
            </button>
          )}
        </>
      )}
      {products.error && (
        <button className="button secondary" onClick={products.refresh}>
          Retry parts
        </button>
      )}
    </section>
  );
}

function RuleDetail({
  rule,
  access,
  userId,
  productType,
  blocked,
  onSaved,
}: {
  rule: StaffFitmentRule;
  access: FitmentAccess;
  userId: string;
  productType: string | null;
  blocked: boolean;
  onSaved: (message: string) => void;
}) {
  const [editingRule, setEditingRule] = useState<StaffFitmentRule | null>(null),
    [proposal, setProposal] = useState<MutationProposal | null>(null),
    [uncertain, setUncertain] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const noteInput = useRef<HTMLTextAreaElement>(null);
  const editable = canEditFitment(access, rule),
    reviewable = canReviewFitment(access, rule, userId);
  const retireable =
    rule.reviewStatus !== "RETIRED" &&
    (editable ||
      access.globalReviewer ||
      (!!rule.branchId && access.reviewBranches.includes(rule.branchId)));
  const editTrigger = useRef<HTMLButtonElement>(null);
  const editRegion = useRef<HTMLElement>(null);
  if (editingRule)
    return (
      <section className="fitment-rule-card" ref={editRegion}>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (
              !window.confirm(
                "Close this editor? Your unsaved changes will not be saved.",
              )
            )
              return;
            editRegion.current
              ?.querySelector("form")
              ?.dispatchEvent(new Event("reset", { bubbles: true }));
            setEditingRule(null);
            requestAnimationFrame(() => editTrigger.current?.focus());
          }}
        >
          Close rule editor
        </button>
        {editingRule.version !== rule.version && (
          <p className="notice" role="alert">
            This rule changed while you were editing. Your draft is preserved. Close the
            editor and inspect the saved version before editing again.
          </p>
        )}
        <RuleEditor
          rule={editingRule}
          productId={rule.productId}
          productType={productType}
          access={access}
          userId={userId}
          blocked={blocked || uncertain || editingRule.version !== rule.version}
          onSaved={() => {
            setEditingRule(null);
            onSaved("Rule updated as a draft. Its previous approval no longer applies.");
          }}
        />
      </section>
    );
  function transition(action: "SUBMIT" | "APPROVE" | "REJECT" | "RETIRE") {
    if (blocked || uncertain || proposal) return;
    if (!note.trim() || /[\u0000-\u001f\u007f]/.test(note.trim())) {
      setError("Write a one-paragraph reason for this decision before reviewing it.");
      noteInput.current?.focus();
      return;
    }
    setError("");
    const body = { expectedVersion: rule.version, action, note: note.trim() };
    setProposal({
      title: `${statusLabel(action)} this fitment rule?`,
      description:
        action === "APPROVE"
          ? "Approval publishes this evidence for customer fitment checks. Confirm the complete vehicle and technical scope before approving."
          : "The decision is recorded in permanent fitment history. It does not change stock or complete an order.",
      retryAfterRejection: false,
      facts: [
        { label: "Part", value: rule.product.name },
        { label: "Rule", value: rule.id },
        { label: "Version", value: String(rule.version) },
        { label: "Decision", value: action },
        { label: "Reason", value: body.note },
      ],
      onUncertain: () => setUncertain(true),
      submit: async () => {
        const saved = z
          .object({
            id: z.uuid(),
            version: z.number().int(),
            reviewStatus: z.enum(reviewStates),
          })
          .parse(
            (
              await apiRequest(
                `${base}/products/${rule.productId}/rules/${rule.id}/transitions`,
                { method: "POST", csrf: true, body },
              )
            ).data,
          );
        if (saved.id !== rule.id || saved.version !== rule.version + 1)
          throw Error("Unexpected fitment decision");
      },
    });
  }
  return (
    <section className="fitment-rule-card" aria-labelledby="fitment-rule-title">
      <span className="fitment-state" data-state={rule.reviewStatus}>
        {statusLabel(rule.reviewStatus)}
      </span>
      <h2 id="fitment-rule-title">Fitment evidence · Version {rule.version}</h2>
      <aside className="fitment-evidence-summary" aria-label="Evidence readiness">
        <h3>Evidence readiness</h3>
        {evidenceGaps(rule).length ? (
          <ul>
            {evidenceGaps(rule).map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : (
          <p>
            Required evidence fields are complete. Independent approval is still a
            separate decision.
          </p>
        )}
      </aside>
      <dl className="fitment-facts">
        <div>
          <dt>Application</dt>
          <dd>
            {rule.scope === "UNIVERSAL"
              ? "Universal accessory"
              : `${rule.make} ${rule.model || "Model not normalized"}, ${fitmentYears(rule.yearFrom, rule.yearTo)}`}
          </dd>
        </div>
        <div>
          <dt>Rule effect</dt>
          <dd>
            {rule.effect === "EXCLUDE"
              ? "Excluded configuration"
              : "Included configuration"}
          </dd>
        </div>
        <div>
          <dt>Branch scope</dt>
          <dd>
            {rule.branchId
              ? access.branches.find((branch) => branch.id === rule.branchId)?.name ||
                "Permitted branch"
              : "Global"}
          </dd>
        </div>
        <div>
          <dt>Safety-critical review</dt>
          <dd>{rule.safetyCritical ? "Required" : "Non-critical part"}</dd>
        </div>
        {fitmentQualifierKeys
          .filter((key) => rule[key] || rule.requiredQualifiers.includes(key))
          .map((key) => (
            <div key={key}>
              <dt>
                {fitmentLabels[key]}
                {rule.requiredQualifiers.includes(key) ? " (required from customer)" : ""}
              </dt>
              <dd>
                {rule[key] || "Required from customer; restriction not yet recorded"}
              </dd>
            </div>
          ))}
        <div>
          <dt>Evidence source</dt>
          <dd>{rule.sourceReference || "Missing"}</dd>
        </div>
        <div>
          <dt>Evidence notes</dt>
          <dd>{rule.evidenceNotes || "Missing"}</dd>
        </div>
        <div>
          <dt>Full stated variant scope confirmed</dt>
          <dd>{rule.allVariantsConfirmed ? "Yes" : "Not yet confirmed"}</dd>
        </div>
        <div>
          <dt>Customer notes</dt>
          <dd>{rule.notes || "None"}</dd>
        </div>
      </dl>
      <details>
        <summary>Other restrictions and audit details</summary>
        <p>
          Unrecorded restrictions are unknown until the stated coverage has been evidenced
          and independently reviewed.
        </p>
        <dl className="fitment-facts">
          {fitmentQualifierKeys
            .filter((key) => !rule[key] && !rule.requiredQualifiers.includes(key))
            .map((key) => (
              <div key={key}>
                <dt>{fitmentLabels[key]}</dt>
                <dd>No restriction recorded</dd>
              </div>
            ))}
          <div>
            <dt>Created by</dt>
            <dd>
              {fitmentAccountLabel(rule.createdBy)} · {formatBusinessDate(rule.createdAt)}
            </dd>
          </div>
          <div>
            <dt>Last edited by</dt>
            <dd>
              {fitmentAccountLabel(rule.updatedBy)} · {formatBusinessDate(rule.updatedAt)}
            </dd>
          </div>
          <div>
            <dt>Last reviewer</dt>
            <dd>
              {fitmentAccountLabel(rule.reviewedBy)}
              {rule.reviewedAt ? ` · ${formatBusinessDate(rule.reviewedAt)}` : ""}
            </dd>
          </div>
          <div>
            <dt>Review reason</dt>
            <dd>{rule.reviewNote || "No review decision"}</dd>
          </div>
        </dl>
      </details>
      {uncertain && (
        <Feedback message="The decision outcome could not be confirmed. Refresh the workspace to inspect the saved version before deciding again." />
      )}
      {!reviewable &&
        rule.reviewStatus === "PENDING" &&
        (rule.createdByUserId === userId || rule.updatedByUserId === userId) && (
          <p className="notice">
            A different authorized technical reviewer must review your rule.
          </p>
        )}
      {(editable || reviewable || retireable) && (
        <>
          <div className="field">
            <label htmlFor="fitment-decision-note">Decision reason</label>
            <textarea
              id="fitment-decision-note"
              ref={noteInput}
              value={note}
              maxLength={1000}
              rows={3}
              disabled={blocked || uncertain || !!proposal}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={!!error}
            />
          </div>
          <Feedback message={error} />
          <div className="actions">
            {editable && ["DRAFT", "REJECTED"].includes(rule.reviewStatus) && (
              <button
                className="button"
                disabled={blocked || uncertain || !!proposal}
                onClick={() => transition("SUBMIT")}
              >
                Submit for technical review
              </button>
            )}
            {reviewable && (
              <>
                <button
                  className="button"
                  disabled={blocked || uncertain || !!proposal}
                  onClick={() => transition("APPROVE")}
                >
                  Approve fitment
                </button>
                <button
                  className="button secondary"
                  disabled={blocked || uncertain || !!proposal}
                  onClick={() => transition("REJECT")}
                >
                  Reject fitment
                </button>
              </>
            )}
            {editable && (
              <button
                ref={editTrigger}
                className="button secondary"
                disabled={blocked || uncertain || !!proposal}
                onClick={() => setEditingRule(rule)}
              >
                Edit rule
              </button>
            )}
            {retireable && (
              <button
                className="button danger"
                disabled={blocked || uncertain || !!proposal}
                onClick={() => transition("RETIRE")}
              >
                Retire rule
              </button>
            )}
          </div>
        </>
      )}
      <RuleHistory key={rule.version} productId={rule.productId} ruleId={rule.id} />
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setProposal(null);
            setNote("");
            onSaved("Fitment decision recorded.");
          }}
          confirmLabel="Confirm fitment decision"
        />
      )}
    </section>
  );
}

function RuleHistory({ productId, ruleId }: { productId: string; ruleId: string }) {
  const [cursor, setCursor] = useState("");
  const history = useResource(
    `${base}/products/${productId}/rules/${ruleId}/history?limit=25${cursor ? `&cursor=${cursor}` : ""}`,
    parseFitmentHistory,
  );
  return (
    <details>
      <summary>Version history and previous evidence</summary>
      <Feedback message={history.error} />
      {history.loading && <p role="status">Loading version history...</p>}
      {history.data && !history.error && (
        <>
          <ol className="fitment-history">
            {history.data.items.map((entry) => (
              <li key={entry.id}>
                <h3>
                  Version {entry.version} ·{" "}
                  {entry.action.toLowerCase().replaceAll("_", " ")}
                </h3>
                <p>
                  {fitmentAccountLabel(entry.actor)} ·{" "}
                  {formatBusinessDate(entry.createdAt)}
                </p>
                <dl className="fitment-facts">
                  {[
                    "reviewStatus",
                    "scope",
                    "effect",
                    "make",
                    "model",
                    "yearFrom",
                    "yearTo",
                    "sourceReference",
                    "evidenceNotes",
                    "reviewNote",
                    ...fitmentQualifierKeys,
                  ].map((key) => {
                    const value = entry.snapshot[key];
                    return (
                      <div key={key}>
                        <dt>
                          {fitmentQualifierKeys.includes(
                            key as (typeof fitmentQualifierKeys)[number],
                          )
                            ? fitmentLabels[key as (typeof fitmentQualifierKeys)[number]]
                            : key.replace(/([A-Z])/g, " $1")}
                        </dt>
                        <dd>
                          {typeof value === "string" || typeof value === "number"
                            ? String(value)
                            : "Not recorded"}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </li>
            ))}
          </ol>
          <div className="actions">
            {history.data.nextCursor && (
              <button
                className="button secondary"
                onClick={() => setCursor(history.data!.nextCursor!)}
              >
                Older versions
              </button>
            )}
            {cursor && (
              <button className="button secondary" onClick={() => setCursor("")}>
                Latest versions
              </button>
            )}
          </div>
        </>
      )}
      {history.error && (
        <button className="button secondary" onClick={history.refresh}>
          Retry history
        </button>
      )}
    </details>
  );
}

function RuleEditor({
  rule,
  productId,
  productType,
  access,
  userId,
  blocked,
  onSaved,
}: {
  rule?: StaffFitmentRule;
  productId: string;
  productType: string | null;
  access: FitmentAccess;
  userId: string;
  blocked: boolean;
  onSaved: (id: string) => void;
}) {
  useEditorLeaveGuard(true);
  const pickerMarker = `fitment-selection:${userId}:${productId}:${rule?.id || "new"}:${rule?.version ?? 0}`;
  const [savedSelection] = useState(() => {
    try {
      const option = z.object({
        id: z.uuid(),
        name: z.string(),
        makeId: z.uuid().optional(),
        yearFrom: z.number().optional(),
        yearTo: z.number().optional(),
      });
      const value = z
        .object({ make: option.nullable(), model: option.nullable() })
        .parse(JSON.parse(sessionStorage.getItem(pickerMarker) || "null"));
      return value.model && value.model.makeId !== value.make?.id ? null : value;
    } catch {
      return null;
    }
  });
  const [make, setMake] = useState<FitmentOption | undefined>(() =>
    savedSelection
      ? (savedSelection.make ?? undefined)
      : rule?.vehicleModel
        ? rule.vehicleModel.make
        : undefined,
  );
  const [model, setModel] = useState<FitmentOption | undefined>(() =>
    savedSelection
      ? (savedSelection.model ?? undefined)
      : rule?.vehicleModel || undefined,
  );
  const selectionChanged = useRef(!!savedSelection);
  const [showSavedLabels, setShowSavedLabels] = useState(!savedSelection);
  const [identityError, setIdentityError] = useState("");
  const [identityRetry, setIdentityRetry] = useState(0);
  const [identityLoading, setIdentityLoading] = useState(
    !!rule?.vehicleModelId && !rule.vehicleModel && !savedSelection,
  );
  useEffect(() => {
    const clear = () => {
      try {
        sessionStorage.removeItem(pickerMarker);
      } catch {
        /* Storage is optional. */
      }
    };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => window.removeEventListener(SESSION_CHANGED, clear);
  }, [pickerMarker]);
  useEffect(() => {
    if (!rule?.vehicleModelId || rule.vehicleModel || selectionChanged.current) return;
    const controller = new AbortController();
    void apiRequest(`/public/fitment/models/${rule.vehicleModelId}`, {
      signal: controller.signal,
    })
      .then((response) => {
        const selected = parseFitmentModel(response.data);
        if (selected.id !== rule.vehicleModelId) throw Error("Mismatched model");
        if (!controller.signal.aborted && !selectionChanged.current) {
          setMake(selected.make);
          setModel(selected);
          setIdentityError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && !selectionChanged.current)
          setIdentityError(
            "The saved catalogue model could not be loaded. Its association has not been changed. Retry or deliberately select a replacement.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIdentityLoading(false);
      });
    return () => controller.abort();
  }, [rule, identityRetry]);
  const [scope, setScope] = useState(rule?.scope || "MODEL");
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [error, setError] = useState("");
  const marker = `fitment-save-pending:${userId}:${productId}:${rule?.id || "create"}`;
  const [uncertain, setUncertain] = useState(() => {
    try {
      return sessionStorage.getItem(marker) === "pending";
    } catch {
      return false;
    }
  });
  const entry = useRef<HTMLFormElement>(null);
  useEffect(() => {
    document.getElementById("fitment-editor-title")?.focus();
  }, []);
  const legacy = rule?.scope === "MODEL" && !rule.vehicleModelId;
  const defaultCritical =
    rule?.safetyCritical ??
    !nonCriticalFitmentTypes.has(productType?.toUpperCase() ?? "");
  const primaryQualifiers = primaryFitmentQualifiers(productType, rule);
  if (defaultCritical)
    for (const key of ["position", "brakeSystem"] as const)
      if (!primaryQualifiers.includes(key)) primaryQualifiers.push(key);
  const qualifierField = (key: (typeof fitmentQualifierKeys)[number]) => (
    <div className="fitment-qualifier" key={key}>
      <label htmlFor={`rule-${key}`}>{fitmentLabels[key]} restriction (optional)</label>
      <input
        id={`rule-${key}`}
        name={key}
        maxLength={100}
        defaultValue={rule?.[key] || ""}
      />
      <label className="check-label">
        <input
          type="checkbox"
          name="requiredQualifiers"
          value={key}
          defaultChecked={
            rule
              ? rule.requiredQualifiers.includes(key)
              : defaultCritical && ["position", "brakeSystem"].includes(key)
          }
        />
        Require {fitmentLabels[key].toLowerCase()} from customer
      </label>
    </div>
  );
  function pending(value: boolean) {
    setUncertain(value);
    try {
      if (value) sessionStorage.setItem(marker, "pending");
      else sessionStorage.removeItem(marker);
    } catch {
      /* Preserve in-memory protection. */
    }
  }
  function review(form: HTMLFormElement) {
    if (blocked || identityLoading || uncertain || proposal || !form.reportValidity())
      return;
    const data = new FormData(form);
    if (scope === "MODEL" && !model?.id) {
      setError("Choose a vehicle make and model from the catalogue before reviewing.");
      document.getElementById("rule-vehicle-make")?.focus();
      return;
    }
    const body = {
      scope,
      vehicleModelId: scope === "MODEL" ? model?.id : null,
      branchId: data.get("branchId") || null,
      yearFrom:
        scope === "MODEL" && data.get("yearFrom") ? Number(data.get("yearFrom")) : null,
      yearTo: scope === "MODEL" && data.get("yearTo") ? Number(data.get("yearTo")) : null,
      effect: scope === "UNIVERSAL" ? "INCLUDE" : String(data.get("effect")),
      safetyCritical: scope === "MODEL" && data.has("safetyCritical"),
      allVariantsConfirmed: data.has("allVariantsConfirmed"),
      requiredQualifiers:
        scope === "MODEL" ? data.getAll("requiredQualifiers").map(String) : [],
      ...Object.fromEntries(
        fitmentQualifierKeys.map((key) => [
          key,
          scope === "MODEL" ? String(data.get(key) || "").trim() || null : null,
        ]),
      ),
      sourceReference: String(data.get("sourceReference") || "").trim() || null,
      evidenceNotes: String(data.get("evidenceNotes") || "").trim() || null,
      notes: String(data.get("notes") || "").trim() || null,
      ...(rule ? { expectedVersion: rule.version } : {}),
    };
    if (body.yearFrom !== null && body.yearTo !== null && body.yearFrom > body.yearTo) {
      setError("The end year must not precede the start year.");
      return;
    }
    setError("");
    setProposal({
      title: "Save this fitment draft?",
      description:
        "Saving an edit removes any previous approval. The complete configuration needs an independent technical review before it can be shown as verified fit.",
      retryAfterRejection: false,
      facts: [
        {
          label: "Application",
          value:
            scope === "UNIVERSAL"
              ? "Universal accessory"
              : `${make?.name} ${model?.name}, ${body.yearFrom || "start year missing"}–${body.yearTo || "end year missing"}`,
        },
        { label: "Effect", value: body.effect },
        { label: "Evidence source", value: body.sourceReference || "Missing" },
        { label: "Evidence", value: body.evidenceNotes || "Missing" },
        ...fitmentQualifierKeys
          .filter((key) => body[key as keyof typeof body])
          .map((key) => ({
            label: fitmentLabels[key],
            value: String(body[key as keyof typeof body]),
          })),
        {
          label: "Required customer details",
          value:
            body.requiredQualifiers
              .map((key) => fitmentLabels[key as (typeof fitmentQualifierKeys)[number]])
              .join(", ") || "None",
        },
      ],
      onUncertain: () => pending(true),
      submit: async () => {
        const saved = z
          .object({
            id: z.uuid(),
            productId: z.uuid(),
            version: z.number().int(),
            reviewStatus: z.literal("DRAFT"),
          })
          .parse(
            (
              await apiRequest(
                `${base}/products/${productId}/rules${rule ? `/${rule.id}` : ""}`,
                { method: rule ? "PUT" : "POST", csrf: true, body },
              )
            ).data,
          );
        if (
          saved.productId !== productId ||
          (rule && (saved.id !== rule.id || saved.version !== rule.version + 1))
        )
          throw Error("Unexpected saved rule");
        pending(false);
        try {
          sessionStorage.removeItem(pickerMarker);
        } catch {
          /* In-memory draft remains available. */
        }
        form.dispatchEvent(new Event("reset", { bubbles: true }));
        onSaved(saved.id);
      },
    });
  }
  return (
    <section aria-labelledby="fitment-editor-title">
      <h2 id="fitment-editor-title" tabIndex={-1}>
        {rule ? "Edit fitment rule" : "Add a fitment rule"}
      </h2>
      <p>
        Enter only supported facts. Blank technical restrictions cover the full stated
        range only after evidence review; they never stand in for a missing required
        customer detail.
      </p>
      <Feedback message={error} />
      {legacy && (
        <p className="notice" role="status">
          Saved legacy association: {rule.make} / {rule.model || "model not recorded"}. It
          has no catalogue identity. Choose the exact catalogue make and model to
          reconcile it; no match will be guessed and no unchanged association will be
          erased.
        </p>
      )}
      {identityLoading && <p role="status">Loading saved catalogue association…</p>}
      {identityError && (
        <>
          <Feedback message={identityError} />
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setIdentityLoading(true);
              setIdentityRetry((v) => v + 1);
            }}
          >
            Retry saved catalogue model
          </button>
        </>
      )}
      {uncertain && (
        <>
          <Feedback message="The save outcome could not be confirmed. Inspect the saved rules before starting another save. This draft will not be resent automatically." />
          <Link
            href={`/admin/fitment?productId=${productId}`}
            className="button secondary"
          >
            Inspect saved rules
          </Link>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              pending(false);
            }}
          >
            I checked the saved rules; unlock this draft
          </button>
        </>
      )}
      <form
        ref={entry}
        onReset={() => {
          try {
            sessionStorage.removeItem(pickerMarker);
          } catch {
            /* Optional storage. */
          }
        }}
        data-draft-key={`fitment-rule:${productId}:${rule?.id || "new"}:${rule?.version || 0}`}
        onSubmit={(event) => {
          event.preventDefault();
          review(event.currentTarget);
        }}
      >
        <fieldset disabled={blocked || uncertain || !!proposal}>
          <legend className="sr-only">Fitment evidence fields</legend>
          <h3>1. Application</h3>
          <div className="fitment-fields">
            <div className="field">
              <label htmlFor="rule-branch">Branch scope</label>
              <select
                id="rule-branch"
                name="branchId"
                defaultValue={rule?.branchId || ""}
                required={!access.globalAuthor}
              >
                {access.globalAuthor && <option value="">Global catalogue</option>}
                {!access.globalAuthor && (
                  <option value="">Choose an authoring branch</option>
                )}
                {access.branches
                  .filter(
                    (branch) =>
                      access.globalAuthor || access.authorBranches.includes(branch.id),
                  )
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rule-scope">Application scope</label>
              <select
                id="rule-scope"
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as "MODEL" | "UNIVERSAL")
                }
              >
                <option value="MODEL">Specific vehicle configurations</option>
                {(productType?.toUpperCase() === "ACCESSORY" ||
                  rule?.scope === "UNIVERSAL") && (
                  <option value="UNIVERSAL">Universal non-critical accessory</option>
                )}
              </select>
            </div>
            {scope === "MODEL" && (
              <>
                <div className="field">
                  <label htmlFor="rule-vehicle-make">Vehicle make</label>
                  <FitmentCataloguePicker
                    id="rule-vehicle-make"
                    kind="make"
                    value={make?.id || ""}
                    selected={
                      make ??
                      (showSavedLabels && rule?.make
                        ? { id: "", name: rule.make }
                        : undefined)
                    }
                    onChange={(value) => {
                      selectionChanged.current = true;
                      setShowSavedLabels(false);
                      setIdentityError("");
                      setIdentityLoading(false);
                      setMake(value);
                      setModel(undefined);
                      try {
                        sessionStorage.setItem(
                          pickerMarker,
                          JSON.stringify({ make: value ?? null, model: null }),
                        );
                      } catch {
                        /* Keep in-memory state. */
                      }
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="rule-vehicle-model">Vehicle model</label>
                  <FitmentCataloguePicker
                    key={make?.id || "unselected"}
                    id="rule-vehicle-model"
                    kind="model"
                    makeId={make?.id}
                    value={model?.id || ""}
                    selected={
                      model ??
                      (showSavedLabels && rule?.model
                        ? { id: "", name: rule.model }
                        : undefined)
                    }
                    disabled={!make}
                    onChange={(value) => {
                      setModel(value);
                      try {
                        sessionStorage.setItem(
                          pickerMarker,
                          JSON.stringify({ make: make ?? null, model: value ?? null }),
                        );
                      } catch {
                        /* Keep in-memory state. */
                      }
                    }}
                  />
                </div>
                <div
                  className="fitment-year-range"
                  role="group"
                  aria-label="Model-year range"
                >
                  <div className="field">
                    <label htmlFor="rule-yearFrom">First model year</label>
                    <input
                      id="rule-yearFrom"
                      name="yearFrom"
                      type="number"
                      inputMode="numeric"
                      min={model?.yearFrom || 1886}
                      max={model?.yearTo || 2200}
                      defaultValue={rule?.yearFrom || ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="rule-yearTo">Last model year</label>
                    <input
                      id="rule-yearTo"
                      name="yearTo"
                      type="number"
                      inputMode="numeric"
                      min={model?.yearFrom || 1886}
                      max={model?.yearTo || 2200}
                      defaultValue={rule?.yearTo || ""}
                    />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="rule-effect">Rule effect</label>
                  <select
                    id="rule-effect"
                    name="effect"
                    defaultValue={rule?.effect || "INCLUDE"}
                  >
                    <option value="INCLUDE">Fits this configuration</option>
                    <option value="EXCLUDE">Does not fit this configuration</option>
                  </select>
                </div>
              </>
            )}
          </div>
          {scope === "MODEL" && (
            <section
              className="fitment-editor-group"
              aria-labelledby="fitment-restrictions"
            >
              <h3 id="fitment-restrictions">2. Restrictions and required details</h3>
              <p>
                Restrictions limit this rule. Required details must also be supplied by
                the customer before a verified match.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="safetyCritical"
                  defaultChecked={defaultCritical}
                />
                Safety-critical fitment
              </label>
              <p className="field-hint">
                Safety-critical rules require position and brake specification evidence
                and both customer details. Existing settings are preserved. Only an
                explicitly supported non-critical product type may use non-critical scope.
              </p>
              <div className="fitment-fields">
                {primaryQualifiers.map(qualifierField)}
              </div>
              <details>
                <summary>Additional technical restrictions</summary>
                <div className="fitment-fields">
                  {fitmentQualifierKeys
                    .filter((key) => !primaryQualifiers.includes(key))
                    .map(qualifierField)}
                </div>
              </details>
            </section>
          )}
          <section className="fitment-editor-group" aria-labelledby="fitment-evidence">
            <h3 id="fitment-evidence">3. Evidence and coverage</h3>
            <div className="fitment-fields">
              <div className="field">
                <label htmlFor="rule-source">Evidence source reference</label>
                <input
                  id="rule-source"
                  name="sourceReference"
                  maxLength={500}
                  defaultValue={rule?.sourceReference || ""}
                />
                <small>
                  Manufacturer catalogue, OEM reference or inspected technical evidence. A
                  guessed association is not evidence.
                </small>
              </div>
              <div className="field">
                <label htmlFor="rule-evidence">Evidence and variant coverage</label>
                <textarea
                  id="rule-evidence"
                  name="evidenceNotes"
                  maxLength={2000}
                  rows={4}
                  defaultValue={rule?.evidenceNotes || ""}
                />
              </div>
              <div className="field">
                <label htmlFor="rule-notes">Customer fitment notes (optional)</label>
                <textarea
                  id="rule-notes"
                  name="notes"
                  maxLength={1000}
                  rows={3}
                  defaultValue={rule?.notes || ""}
                />
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="allVariantsConfirmed"
                  defaultChecked={rule?.allVariantsConfirmed || false}
                />
                The evidence supports every configuration within the stated years and
                restrictions, including unrestricted variants.
              </label>
            </div>
          </section>
          <h3>4. Review draft</h3>
          <p>
            Review the complete application and evidence before saving. Saving never
            grants approval.
          </p>
          <button className="button" type="submit" disabled={identityLoading}>
            Review fitment draft
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          confirmLabel="Confirm fitment draft"
        />
      )}
    </section>
  );
}

function RegistryEditor({ onSaved }: { onSaved: () => void }) {
  const [make, setMake] = useState<FitmentOption>();
  const [existingModel, setExistingModel] = useState<FitmentOption>();
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [uncertain, setUncertain] = useState(false),
    [message, setMessage] = useState("");
  function review(form: HTMLFormElement, kind: "makes" | "models") {
    if (proposal || uncertain || !form.reportValidity()) return;
    const values = new FormData(form);
    if (kind === "models" && !make) {
      setMessage("Choose a catalogue make before adding a model.");
      return;
    }
    const body =
      kind === "makes"
        ? { name: String(values.get("name")).trim() }
        : {
            makeId: make!.id,
            name: String(values.get("name")).trim(),
            yearFrom: Number(values.get("yearFrom")),
            yearTo: Number(values.get("yearTo")),
            sourceReference: String(values.get("sourceReference")).trim(),
          };
    setProposal({
      title: `Add this vehicle ${kind === "makes" ? "make" : "model"}?`,
      description:
        "This shared vehicle catalogue supports parts fitment and saved customer configurations independently of vehicles offered for sale. Use a real, source-backed name and model-year range.",
      retryAfterRejection: false,
      facts: Object.entries(body).map(([label, value]) => ({
        label,
        value: String(value),
      })),
      onUncertain: () => setUncertain(true),
      submit: async () => {
        z.object({ id: z.uuid() }).parse(
          (await apiRequest(`${base}/${kind}`, { method: "POST", csrf: true, body }))
            .data,
        );
        form.reset();
      },
    });
  }
  return (
    <details className="fitment-registry" id="fitment-catalogue">
      <summary>Vehicle catalogue maintenance</summary>
      <p>
        Search existing entries first to avoid duplicates. Sale stock and customer
        ownership are separate.
      </p>
      <Feedback message={message} tone="info" />
      <div className="fitment-fields">
        <div className="field">
          <label htmlFor="registry-search-make">Search existing makes</label>
          <FitmentCataloguePicker
            id="registry-search-make"
            kind="make"
            value={make?.id || ""}
            selected={make}
            onChange={(value) => {
              setMake(value);
              setExistingModel(undefined);
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="registry-search-model">Search models for this make</label>
          <FitmentCataloguePicker
            key={make?.id || "none"}
            id="registry-search-model"
            kind="model"
            makeId={make?.id}
            value={existingModel?.id || ""}
            selected={existingModel}
            disabled={!make}
            onChange={setExistingModel}
          />
        </div>
      </div>
      {existingModel && (
        <p role="status">
          {make?.name} {existingModel.name} already exists ·{" "}
          {fitmentYears(existingModel.yearFrom ?? null, existingModel.yearTo ?? null)}.
          Use this entry rather than creating a duplicate.
        </p>
      )}
      {uncertain && (
        <Feedback message="The catalogue save could not be confirmed. Refresh the workspace and search existing makes or models before attempting another creation." />
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          review(event.currentTarget, "makes");
        }}
      >
        <fieldset disabled={!!proposal || uncertain}>
          <legend>Add a make</legend>
          <div className="field">
            <label htmlFor="registry-make-name">Make name</label>
            <input id="registry-make-name" name="name" required maxLength={100} />
          </div>
          <button className="button secondary">Review new make</button>
        </fieldset>
      </form>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          review(event.currentTarget, "models");
        }}
      >
        <fieldset disabled={!!proposal || uncertain}>
          <legend>Add a model and its supported years</legend>
          <div className="fitment-fields">
            <div className="field">
              <label htmlFor="registry-model-make">Existing make</label>
              <FitmentCataloguePicker
                id="registry-model-make"
                kind="make"
                value={make?.id || ""}
                selected={make}
                onChange={(value) => {
                  setMake(value);
                  setExistingModel(undefined);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="registry-model-name">Model name</label>
              <input id="registry-model-name" name="name" required maxLength={100} />
            </div>
            <div
              className="fitment-year-range"
              role="group"
              aria-label="Supported model years"
            >
              <div className="field">
                <label htmlFor="registry-yearFrom">First supported year</label>
                <input
                  id="registry-yearFrom"
                  name="yearFrom"
                  type="number"
                  min={1886}
                  max={2200}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="registry-yearTo">Last supported year</label>
                <input
                  id="registry-yearTo"
                  name="yearTo"
                  type="number"
                  min={1886}
                  max={2200}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="registry-source">Model-year source reference</label>
              <input
                id="registry-source"
                name="sourceReference"
                required
                maxLength={500}
              />
            </div>
          </div>
          <button className="button secondary">Review new model</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {
            setProposal(null);
            setMessage(
              "Catalogue entry saved. Search its name in the catalogue before adding a fitment rule.",
            );
            onSaved();
          }}
          confirmLabel="Confirm catalogue entry"
        />
      )}
    </details>
  );
}
