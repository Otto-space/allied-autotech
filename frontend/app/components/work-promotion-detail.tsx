"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Layers,
  Pencil,
  RefreshCw,
  Tag,
} from "lucide-react";
import { parsePromotionDetail } from "@/lib/admin/promotion-detail";
import type { Promotion } from "@/lib/api/promotion-schemas";
import { useResource } from "@/lib/api/use-resource";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { PromotionEditor } from "./promotion-editor";
import { formatPromotionDate, promotionDiscount } from "./promotion-summary";

export function WorkPromotionDetail({ id }: { id: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Promotion</h1>
        <Feedback message="Administrator access is required to manage promotions." />
      </>
    );
  return (
    <PromotionRecord
      key={`${session.user.id}:${session.user.role}:${id}`}
      id={id}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function PromotionRecord({
  id,
  owner,
  role,
}: {
  id: string;
  owner: string;
  role: string;
}) {
  const parse = useCallback((value: unknown) => parsePromotionDetail(value, id), [id]);
  const resource = useResource(`/admin/promotions/${id}`, parse);
  const [observed, setObserved] = useState<Promotion>();
  // A read started before a confirmed write must not replace its newer version.
  // Denied/not-found reads still remove all private facts through resource.data.
  const record =
    resource.data && observed && observed.version >= resource.data.version
      ? observed
      : resource.data;
  const busy = resource.loading || resource.refreshing,
    error = resource.error || resource.refreshError;
  const blocked = busy || !!error || !record;
  const optionalMoney = (value: string | null) =>
    value === null ? "Not set" : formatKobo(value);
  const date = (value: string) => (
    <time dateTime={value}>{formatPromotionDate(value)}</time>
  );
  return (
    <div className="work-promotion-create work-promotion-detail">
      <nav className="pc-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin/promotions">Promotions</Link>
        <ChevronRight aria-hidden="true" />
        <span aria-current="page">{record?.name ?? "Promotion"}</span>
      </nav>
      <header className="pc-header pd-header">
        <div className="pd-title">
          <div>
            <h1>{record?.name ?? "Promotion"}</h1>
            {record && (
              <span className="pd-configuration">
                {record.isActive ? "Enabled" : "Disabled"}
              </span>
            )}
          </div>
          <p>Promotion configuration and future checkout rules.</p>
        </div>
        <div className="pd-actions">
          <Link className="pc-back" href="/admin/promotions">
            <ArrowLeft aria-hidden="true" />
            Back to promotions
          </Link>
          <button className="button secondary" disabled={busy} onClick={resource.refresh}>
            <RefreshCw aria-hidden="true" />
            {busy ? "Refreshing…" : "Refresh promotion"}
          </button>
          <button
            className="button"
            disabled={blocked}
            onClick={() => {
              const heading = document.getElementById("promotion-editor-title");
              heading?.focus({ preventScroll: true });
              heading?.scrollIntoView({ block: "start" });
            }}
          >
            <Pencil aria-hidden="true" />
            Edit settings
          </button>
        </div>
      </header>
      <Feedback message={error} />
      {busy && <p role="status">Checking promotion…</p>}
      {!!error && record && (
        <p className="pd-stale" role="status">
          Previously loaded settings are shown. Editing is locked until this promotion can
          be refreshed.
        </p>
      )}
      {!record && !busy && error && (
        <section className="pd-unavailable">
          <h2>Promotion unavailable</h2>
          <p>Refresh to check access and the current saved record.</p>
          <button className="button secondary" onClick={resource.refresh}>
            Retry promotion
          </button>
        </section>
      )}
      {record && (
        <div className="pc-layout pd-layout">
          <div className="pd-main">
            <section
              className="pd-overview"
              aria-labelledby="pd-overview-title"
              aria-busy={busy}
            >
              <h2 id="pd-overview-title">Offer configuration</h2>
              <p className="preserve-lines pd-description">
                {record.description ?? "No description recorded."}
              </p>
              <dl className="pd-facts">
                <div>
                  <dt>Code</dt>
                  <dd>{record.code ?? "No redemption code"}</dd>
                </div>
                <div>
                  <dt>Discount</dt>
                  <dd>{promotionDiscount(record)}</dd>
                </div>
                <div>
                  <dt>Minimum subtotal</dt>
                  <dd>{optionalMoney(record.minimumOrderAmountKobo)}</dd>
                </div>
                <div>
                  <dt>Discount cap</dt>
                  <dd>{optionalMoney(record.maximumDiscountAmountKobo)}</dd>
                </div>
                <div>
                  <dt>Total usage limit</dt>
                  <dd>{record.usageLimit ?? "Not set"}</dd>
                </div>
                <div>
                  <dt>Per-customer limit</dt>
                  <dd>{record.perCustomerLimit ?? "Not set"}</dd>
                </div>
              </dl>
              <dl className="pd-schedule">
                <div>
                  <dt>Starts</dt>
                  <dd>{date(record.startsAt)}</dd>
                </div>
                <div>
                  <dt>Ends</dt>
                  <dd>{date(record.endsAt)}</dd>
                </div>
              </dl>
              <dl className="pd-metadata">
                <div>
                  <dt>Record version</dt>
                  <dd>{record.version}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{date(record.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{date(record.updatedAt)}</dd>
                </div>
                <div className="pd-reference">
                  <dt>Record reference</dt>
                  <dd>{record.id}</dd>
                </div>
              </dl>
            </section>
            <PromotionEditor
              current={record}
              owner={owner}
              role={role}
              disabled={blocked}
              onRefresh={resource.refresh}
              onObserved={setObserved}
            />
          </div>
          <aside className="pc-guidance" aria-labelledby="pd-guidance-title">
            <h2 id="pd-guidance-title">Before you save</h2>
            <div>
              <ClipboardList aria-hidden="true" />
              <section>
                <h3>Future checkout</h3>
                <p>
                  Changes apply to future checkout eligibility. Existing order discounts
                  stay unchanged.
                </p>
              </section>
            </div>
            <div>
              <Layers aria-hidden="true" />
              <section>
                <h3>Usage visibility</h3>
                <p>
                  Configured limits are shown here. Redemption counts and remaining uses
                  are not available.
                </p>
              </section>
            </div>
            <div>
              <Tag aria-hidden="true" />
              <section>
                <h3>Customer redemption</h3>
                <p>
                  A code is required for customer redemption. Enabled does not guarantee
                  eligibility. Code-less offers are not automatically applied.
                </p>
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
