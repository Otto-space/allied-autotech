"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, RefreshCw, ShieldCheck } from "lucide-react";
import {
  parsePrivacyPage,
  privacyKinds,
  privacyStatuses,
  type PrivacyRequest,
} from "@/lib/api/privacy-schemas";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { PrivacyRequestForm } from "./privacy-request-form";

function RequestRecord({ record }: { record: PrivacyRequest }) {
  return (
    <article
      className="privacy-record cpv-record"
      aria-labelledby={`request-${record.id}`}
    >
      <div className="cpv-record-heading">
        <h3 id={`request-${record.id}`}>{privacyKinds[record.kind]}</h3>
        <strong className="cpv-status">{privacyStatuses[record.status]}</strong>
      </div>
      <p className="cpv-date">Requested {formatBusinessDate(record.createdAt)}</p>
      <p className="preserve-lines">{record.reason}</p>
      {record.status === "APPROVED_PENDING_POLICY" && (
        <p className="cpv-policy">
          Your request has been approved for review purposes. Your information has not
          been deleted or anonymized.
        </p>
      )}
      {(record.reviewedAt || record.reviewNote) && (
        <div className="cpv-response">
          <h4>Response from Allied AutoTech</h4>
          {record.reviewedAt && (
            <p className="cpv-date">Reviewed {formatBusinessDate(record.reviewedAt)}</p>
          )}
          {record.reviewNote && <p className="preserve-lines">{record.reviewNote}</p>}
          {!record.reviewNote && <p>No written response is recorded yet.</p>}
        </div>
      )}
    </article>
  );
}

function CustomerRequests({ userId }: { userId: string }) {
  const pagination = useCursorPage();
  const parse = useCallback(
    (value: unknown) => {
      const page = parsePrivacyPage(value);
      if (page.items.some((item) => item.userId !== userId))
        throw new Error("Unexpected privacy account");
      return page;
    },
    [userId],
  );
  const records = useResource(
    `/customers/privacy-requests?limit=10${pagination.cursor ? `&cursor=${encodeURIComponent(pagination.cursor)}` : ""}`,
    parse,
  );
  const marker = `aat:privacy-request:v1:${userId}`;
  const [recovery, setRecovery] = useState<{
    uncertain: boolean;
    afterRevision: number;
    refreshed: boolean;
  }>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [storageError, setStorageError] = useState<string>();
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        setRecovery({
          uncertain: sessionStorage.getItem(marker) !== null,
          afterRevision: -1,
          refreshed: false,
        });
      } catch {
        setRecovery({ uncertain: false, afterRevision: -1, refreshed: false });
      }
    });
    return () => {
      active = false;
    };
  }, [marker]);
  const stale = !!(records.error || records.refreshError);
  const unavailable = records.loading || records.refreshing || stale || !records.data;
  const canAcknowledge =
    !!recovery?.refreshed &&
    !unavailable &&
    pagination.page === 1 &&
    records.settledRevision !== null &&
    records.settledRevision > (recovery?.afterRevision ?? -1);
  function clearMarker() {
    try {
      sessionStorage.removeItem(marker);
      return true;
    } catch {
      setRecovery({
        uncertain: true,
        afterRevision: records.settledRevision ?? 0,
        refreshed: false,
      });
      setStorageError(
        "Your browser could not clear the request recovery marker. Allow session storage and refresh this page.",
      );
      return false;
    }
  }
  function refresh() {
    if (reviewOpen) return;
    if (recovery?.uncertain) {
      pagination.reset();
      setRecovery({
        uncertain: true,
        afterRevision: records.settledRevision ?? 0,
        refreshed: true,
      });
    }
    records.refresh();
  }
  const refreshButton = (
    <button
      className="button secondary"
      onClick={refresh}
      disabled={records.loading || records.refreshing || reviewOpen}
    >
      <RefreshCw size={16} aria-hidden="true" />
      {records.loading || records.refreshing
        ? "Refreshing requests\u2026"
        : "Refresh privacy requests"}
    </button>
  );
  return (
    <div className="customer-privacy">
      <header className="cpv-heading">
        <h1>Privacy requests</h1>
        <p>Request a review of your personal information and follow the response.</p>
      </header>
      <Feedback message={storageError} />
      {recovery?.uncertain && (
        <section className="cpv-recovery" aria-label="Request recovery">
          <Feedback
            tone="warning"
            message="We could not confirm your request. Refresh your latest requests and check the saved explanation before making another request."
          />
          <div className="actions">
            {refreshButton}
            <a className="button secondary" href="#privacy-history-title">
              View request history
            </a>
          </div>
          <button
            className="button secondary"
            disabled={!canAcknowledge || reviewOpen}
            onClick={() => {
              if (canAcknowledge && clearMarker()) {
                setRecovery({ uncertain: false, afterRevision: -1, refreshed: false });
                setStorageError(undefined);
              }
            }}
          >
            I have checked my requests
          </button>
        </section>
      )}
      {stale && records.data && (
        <Feedback
          tone="warning"
          message="Saved requests are out of date. Refresh your privacy requests before sending another request."
        />
      )}
      <div className="cpv-compose">
        <aside className="cpv-guidance" aria-labelledby="privacy-guide-title">
          <ShieldCheck size={28} strokeWidth={1.6} aria-hidden="true" />
          <h2 id="privacy-guide-title">A request for review</h2>
          <p>
            Submitting a request does not delete or anonymize your information, even after
            approval.
          </p>
          <ol>
            <li>Choose a request</li>
            <li>Explain what it concerns</li>
            <li>Review before sending</li>
          </ol>
          <Link href="/dashboard/profile">
            Manage your profile <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
        <PrivacyRequestForm
          userId={userId}
          disabled={!recovery || unavailable || !!recovery?.uncertain}
          onReviewChange={setReviewOpen}
          onSend={() => {
            try {
              sessionStorage.setItem(marker, "pending");
              return sessionStorage.getItem(marker) === "pending";
            } catch {
              return false;
            }
          }}
          onRejected={clearMarker}
          onUncertain={() =>
            setRecovery({
              uncertain: true,
              afterRevision: records.settledRevision ?? 0,
              refreshed: false,
            })
          }
          onSaved={() => {
            clearMarker();
            pagination.reset();
            records.refresh();
          }}
        />
      </div>
      <section
        className="cpv-history"
        aria-labelledby="privacy-history-title"
        aria-busy={records.loading || records.refreshing}
      >
        <div className="cpv-history-heading">
          <div>
            <h2 id="privacy-history-title">Your requests</h2>
            <p>Latest requests first. All times shown in Lagos time.</p>
          </div>
          {!recovery?.uncertain && refreshButton}
        </div>
        <Feedback message={records.error || records.refreshError} />
        {records.loading && !records.data && (
          <div className="cpv-loading" role="status">
            <span>Loading privacy requests…</span>
            <div aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        {!records.error && records.data && (
          <>
            {records.data.items.length === 0 && (
              <div className="cpv-empty">
                <h3>
                  {pagination.page === 1
                    ? "No privacy requests yet"
                    : "No requests on this page"}
                </h3>
                <p>
                  {pagination.page === 1
                    ? "Requests you send will appear here with their review status."
                    : "Return to the previous page to see earlier requests."}
                </p>
              </div>
            )}
            {records.data.items.map((record) => (
              <RequestRecord key={record.id} record={record} />
            ))}
            <CursorPagination
              pagination={pagination}
              nextCursor={records.data.nextCursor}
              disabled={unavailable || reviewOpen || !!recovery?.uncertain}
              label="Privacy requests"
            />
          </>
        )}
      </section>
    </div>
  );
}

export function CustomerPrivacy() {
  const session = useAccountSession();
  if (!session || session.user.role !== "CUSTOMER") return null;
  return <CustomerRequests key={session.user.id} userId={session.user.id} />;
}
