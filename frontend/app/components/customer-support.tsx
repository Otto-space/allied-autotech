"use client";
import "./care-workspace.css";
import { StatusBadge } from "./status-progress";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import {
  parseSupportPage,
  supportStatuses,
  type SupportKind,
} from "@/lib/api/support-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { useSupportCreateWrite } from "@/lib/support/use-support-create-write";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { Feedback } from "./feedback";
import { SupportCreationRecovery } from "./support-creation-recovery";
import { SupportCreateForm } from "./support-create-form";

const label = (value: string) =>
  value[0] + value.slice(1).toLowerCase().replaceAll("_", " ");

function SupportCategory({
  userId,
  kind,
  onReviewChange,
}: {
  userId: string;
  kind: SupportKind;
  onReviewChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const pagination = useCursorPage();
  const parse = useCallback(
    (value: unknown) => parseSupportPage(kind, false, value),
    [kind],
  );
  const records = useResource(
    `/customers/support/${kind}?limit=20${status ? `&status=${status}` : ""}${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  const guard = useSupportCreateWrite(userId, kind, records);
  const reading = records.loading || records.refreshing;
  const stale = !!(records.error || records.refreshError);
  function refresh() {
    if (reviewOpen || guard.busy) return;
    if (guard.pending) {
      setStatus("");
      pagination.reset();
    }
    guard.refresh();
  }
  const reviewChanged = useCallback(
    (open: boolean) => {
      setReviewOpen(open);
      onReviewChange(open);
    },
    [onReviewChange],
  );
  return (
    <>
      <Feedback message={guard.storageError} />
      <SupportCreationRecovery
        guard={guard}
        kind={kind}
        disabled={reviewOpen || !!status || pagination.page !== 1}
        onReviewChange={reviewChanged}
        onRecovered={(id) => router.push(`/dashboard/support/${kind}/${id}`)}
      />
      {stale && records.data && (
        <Feedback
          tone="warning"
          message="Your records are out of date. Refresh them before sending another request."
        />
      )}
      <div className="cc-layout">
        <details className="care-create">
          <summary>{kind === "enquiries" ? "New enquiry" : "Make a complaint"}</summary>
          <SupportCreateForm
            kind={kind}
            presentation="dashboard"
            userId={userId}
            guard={guard}
            onReviewChange={reviewChanged}
            locked={guard.pending}
            onUncertain={() => {}}
            onSaved={(id) => router.push(`/dashboard/support/${kind}/${id}`)}
          />
        </details>
        <section
          className="cc-history"
          aria-labelledby="support-list-heading"
          aria-busy={reading}
        >
          <div className="cc-history-heading">
            <h2 id="support-list-heading" tabIndex={-1}>
              Your records
            </h2>
            <p>Open a record to read or reply.</p>
          </div>
          <div className="cc-history-controls">
            <div className="field">
              <label htmlFor="support-status-filter">Record status</label>
              <select
                id="support-status-filter"
                value={status}
                disabled={reading || reviewOpen || guard.busy}
                onChange={(event) => {
                  setStatus(event.target.value);
                  pagination.reset();
                }}
              >
                <option value="">All statuses</option>
                {supportStatuses[kind].map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="button secondary"
              disabled={reading || reviewOpen || guard.busy}
              onClick={refresh}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh support records
            </button>
            <button
              className="button secondary"
              disabled={reading || reviewOpen || guard.busy}
              onClick={() => {
                setStatus("");
                pagination.reset();
              }}
            >
              Clear support filters
            </button>
          </div>
          <Feedback message={records.error || records.refreshError} />
          {records.loading && (
            <div className="cc-loading" role="status">
              <span className="sr-only">Checking support records…</span>
              {[1, 2].map((item) => (
                <div className="cc-skeleton" key={item} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
              ))}
            </div>
          )}
          {!records.loading && !records.error && records.data?.items.length === 0 && (
            <div className="cc-empty">
              <h3>
                {status || pagination.page > 1 ? "No matching records" : `No ${kind} yet`}
              </h3>
              <p>
                {status || pagination.page > 1
                  ? "No support records match this page and filters."
                  : `Your ${kind} will appear here.`}
              </p>
            </div>
          )}
          {!records.loading && !records.error && (
            <div
              className="care-table-region"
              role="region"
              aria-label="Your customer care requests"
              tabIndex={0}
            >
              <table className="care-table">
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.data?.items.map((record) => (
                    <tr className="cc-record" key={record.id}>
                      <td>{record.subject}</td>
                      <td>{kind === "enquiries" ? "Enquiry" : "Complaint"}</td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                      <td>
                        <time dateTime={record.updatedAt}>
                          {formatBusinessDate(record.updatedAt)}
                        </time>
                      </td>
                      <td>
                        <Link
                          className="text-link"
                          href={"/dashboard/support/" + kind + "/" + record.id}
                        >
                          View <ChevronRight size={16} aria-hidden="true" />
                          <span className="sr-only"> {record.subject}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CursorPagination
            pagination={pagination}
            nextCursor={!stale ? records.data?.nextCursor : undefined}
            disabled={reading || reviewOpen || guard.busy}
            label="Support records"
          />
          <p className="cc-service-note">
            This is not live chat. Response times may vary.
          </p>
        </section>
      </div>
    </>
  );
}

export function CustomerSupport({ userId }: { userId: string }) {
  const [kind, setKind] = useState<SupportKind>("enquiries");
  const [reviewOpen, setReviewOpen] = useState(false);
  return (
    <div className="customer-care">
      <header className="cc-heading">
        <div>
          <span className="eyebrow">Customer care</span>
          <h1>Your conversations</h1>
          <p>
            Track enquiries and complaints, read responses and continue the conversation.
          </p>
        </div>
        <Link href="/help">
          Help centre <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <div className="cc-toolbar">
        <div className="field">
          <label htmlFor="support-record-kind">Record category</label>
          <select
            id="support-record-kind"
            aria-describedby="support-kind-help"
            value={kind}
            disabled={reviewOpen}
            onChange={(event) =>
              setKind(event.target.value === "complaints" ? "complaints" : "enquiries")
            }
          >
            <option value="enquiries">Enquiries</option>
            <option value="complaints">Complaints</option>
          </select>
        </div>
        <nav className="cc-jump-links" aria-label="Customer care tasks">
          <a
            href="#support-create-heading"
            onClick={() => {
              const details = document.querySelector(".care-create");
              if (details instanceof HTMLDetailsElement) details.open = true;
            }}
          >
            Write a request <ArrowRight size={16} aria-hidden="true" />
          </a>
          <a href="#support-list-heading">
            View your records <ArrowRight size={16} aria-hidden="true" />
          </a>
        </nav>
      </div>
      <p className="cc-kind-help" id="support-kind-help">
        {kind === "enquiries"
          ? "Ask about a service, part or vehicle. For an existing request, open its record and reply there."
          : "Tell us about a problem and the outcome you need. For an existing complaint, reply in its record."}
      </p>
      <SupportCategory
        key={kind}
        userId={userId}
        kind={kind}
        onReviewChange={setReviewOpen}
      />
    </div>
  );
}
