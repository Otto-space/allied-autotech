"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { parsePromotion, parsePromotions } from "@/lib/api/promotion-schemas";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { PromotionSummary } from "./promotion-summary";
import { PromotionEditor } from "./promotion-editor";
function useAllowed() {
  const session = useAccountSession();
  return session?.user.role === "ADMIN" || session?.user.role === "SUPER_ADMIN";
}
const denied = (
  <Feedback message="Administrator access is required to manage promotions." />
);
export function PromotionList() {
  const allowed = useAllowed();
  const [active, setActive] = useState("");
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "25" });
  if (active) query.set("isActive", active);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const records = useResource(
    allowed ? `/admin/promotions?${query}` : null,
    parsePromotions,
  );
  if (!allowed)
    return (
      <>
        <h1>Promotions</h1>
        {denied}
      </>
    );
  return (
    <>
      <h1>Promotions</h1>
      <p className="lead">
        Manage checkout discounts, eligibility windows and configured usage limits.
      </p>
      <Link className="button" href="/admin/promotions/new">
        Create promotion
      </Link>
      <div className="field filter-field">
        <label htmlFor="promotion-active">Configuration filter</label>
        <select
          id="promotion-active"
          value={active}
          onChange={(event) => {
            setActive(event.target.value);
            pagination.reset();
          }}
        >
          <option value="">All promotions</option>
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>
      </div>
      <Feedback message={records.error} />
      <button
        className="button secondary"
        disabled={records.loading}
        onClick={records.refresh}
      >
        Refresh promotions
      </button>
      {records.loading && <p role="status">Checking promotions…</p>}
      {!records.loading && !records.error && !records.data?.items.length && (
        <div className="empty">
          <h2>{active ? "No matching promotions" : "No promotions yet"}</h2>
          <p>
            {active
              ? "Change the configuration filter or refresh to check again."
              : "Create a promotion when its discount and eligibility rules are approved."}
          </p>
        </div>
      )}
      {records.data?.items.map((item) => (
        <section className="detail-section" key={item.id}>
          <h2>{item.name}</h2>
          <PromotionSummary item={item} />
          <Link className="text-link" href={`/admin/promotions/${item.id}`}>
            Manage {item.name}
          </Link>
        </section>
      ))}
      <p className="muted">
        Enabled is a configuration setting. Dates, subtotal and usage limits are checked
        at checkout. These records do not include redemption counts or remaining uses.
      </p>
      <CursorPagination
        pagination={pagination}
        nextCursor={records.data?.nextCursor}
        disabled={records.loading || !!records.error}
        label="Promotions"
      />
    </>
  );
}
export function PromotionDetail({ id }: { id: string }) {
  const allowed = useAllowed();
  const parse = useCallback(
    (value: unknown) => {
      const item = parsePromotion(value);
      if (item.id !== id) throw new Error("Unexpected promotion");
      return item;
    },
    [id],
  );
  const record = useResource(allowed ? `/admin/promotions/${id}` : null, parse);
  if (!allowed)
    return (
      <>
        <h1>Promotion</h1>
        {denied}
      </>
    );
  return (
    <>
      <h1>Promotion</h1>
      <Link className="text-link" href="/admin/promotions">
        Back to promotions
      </Link>
      <Feedback message={record.error} />
      <div className="actions">
        <button
          className="button secondary"
          disabled={record.loading}
          onClick={record.refresh}
        >
          Refresh promotion
        </button>
      </div>
      {record.loading && <p role="status">Checking promotion…</p>}
      {record.data && (
        <>
          <section className="detail-section">
            <h2>{record.data.name}</h2>
            <p className="preserve-lines">
              {record.data.description ?? "No description recorded."}
            </p>
            <PromotionSummary item={record.data} />
          </section>
          <PromotionEditor
            current={record.data}
            disabled={record.loading || !!record.error}
            onRefresh={record.refresh}
          />
        </>
      )}
    </>
  );
}
export function PromotionCreate() {
  const allowed = useAllowed();
  return (
    <>
      <h1>Create promotion</h1>
      {allowed ? (
        <>
          <Link className="text-link" href="/admin/promotions">
            Back to promotions
          </Link>
          <PromotionEditor />
        </>
      ) : (
        denied
      )}
    </>
  );
}
