"use client";
import { useCallback, useState } from "react";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
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
import { PrivacyRequestReview } from "./privacy-request-review";
export function PrivacyRecord({
  record,
  staff = false,
}: {
  record: PrivacyRequest;
  staff?: boolean;
}) {
  return (
    <>
      <h3>{privacyKinds[record.kind]}</h3>
      <p>
        <strong>{privacyStatuses[record.status]}</strong> · Requested{" "}
        {formatBusinessDate(record.createdAt)}
      </p>
      <p className="preserve-lines">{record.reason}</p>
      {staff && <p className="field-hint">Account reference: {record.userId}</p>}
      {record.reviewedAt && <p>Reviewed {formatBusinessDate(record.reviewedAt)}</p>}
      {record.reviewNote && (
        <p className="preserve-lines">Review response: {record.reviewNote}</p>
      )}
    </>
  );
}
function PrivacyQueue({
  staff,
  userId,
  uncertain,
  onUncertain,
}: {
  staff: boolean;
  userId: string;
  uncertain: boolean;
  onUncertain: () => void;
}) {
  const pagination = useCursorPage();
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState<string>();
  const parse = useCallback(
    (value: unknown) => {
      const page = parsePrivacyPage(value);
      if (!staff && page.items.some((item) => item.userId !== userId))
        throw new Error("Unexpected privacy account");
      return page;
    },
    [staff, userId],
  );
  const record = useResource(
    `/${staff ? "staff" : "customers"}/privacy-requests?limit=10${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  const current = !record.error
    ? record.data?.items.find((item) => item.id === selected)
    : undefined;
  const disabled = uncertain || record.loading || !!record.error || !record.data;
  function refresh() {
    record.refresh();
  }
  return (
    <>
      {!staff && (
        <PrivacyRequestForm
          userId={userId}
          disabled={disabled}
          onUncertain={onUncertain}
          onSaved={() => {
            pagination.reset();
            record.refresh();
          }}
        />
      )}
      <div className="actions">
        <button className="button secondary" onClick={refresh} disabled={record.loading}>
          Refresh privacy requests
        </button>
      </div>
      <Feedback message={record.error} />
      <Feedback message={message} tone="success" toast="Privacy review saved." />
      {record.loading && <p role="status">Loading privacy requests…</p>}
      {!record.error && record.data && (
        <>
          <h2>{staff ? "Requests for review" : "Your requests"}</h2>
          {record.data.items.length === 0 && (
            <p>
              {pagination.page === 1
                ? "No privacy requests are recorded."
                : "No requests on this page. Return to the previous page."}
            </p>
          )}
          {record.data.items.map((item) => (
            <article key={item.id} className="detail-section privacy-record">
              <PrivacyRecord record={item} staff={staff} />
              {staff && (
                <button
                  className="button secondary"
                  aria-expanded={selected === item.id}
                  disabled={record.loading || !!record.error}
                  onClick={() => setSelected(selected === item.id ? undefined : item.id)}
                >
                  Review request from {formatBusinessDate(item.createdAt)}
                </button>
              )}
              {staff && current?.id === item.id && (
                <PrivacyRequestReview
                  key={`${item.id}:${item.reviewedAt ?? "new"}`}
                  record={item}
                  disabled={disabled}
                  onSaved={() => {
                    setMessage(
                      "Privacy review saved. No deletion or anonymization has been scheduled.",
                    );
                    refresh();
                  }}
                  onUncertain={onUncertain}
                />
              )}
            </article>
          ))}
          <CursorPagination
            pagination={pagination}
            nextCursor={record.data.nextCursor}
            disabled={record.loading}
            label="Privacy requests"
          />
        </>
      )}
    </>
  );
}
export function PrivacyRequests({ staff = false }: { staff?: boolean }) {
  const session = useAccountSession();
  const [uncertain, setUncertain] = useState(false);
  const permission = useResource(
    staff && session ? "/staff/profile" : null,
    parseOwnStaffProfile,
  );
  const allowed =
    !staff ||
    (!permission.error &&
      !permission.loading &&
      permission.data?.id === session?.user.id &&
      permission.data?.role === session?.user.role &&
      permission.data?.status === "ACTIVE" &&
      permission.data?.capabilities.includes("PRIVACY_REVIEW"));
  return (
    <>
      <h1>{staff ? "Privacy review" : "Privacy requests"}</h1>
      <p>
        {staff
          ? "Review customer requests and retention holds. Notes entered during review are visible to the customer."
          : "Ask us to review anonymization or deletion of your personal information, and follow your request here."}
      </p>
      <p>
        This service currently records requests and review decisions. It does not delete
        or anonymize {staff ? "customer information" : "your information"}, even after
        approval.
      </p>
      {uncertain && (
        <Feedback
          tone="warning"
          message="The outcome of a change is uncertain. Review refreshed requests and holds before reloading to make further changes."
        />
      )}
      {staff && (
        <>
          <Feedback message={permission.error} />
          {permission.loading && (
            <p role="status">Checking your privacy review permission…</p>
          )}
          {!allowed && !permission.loading && (
            <Feedback message="Privacy review requires an active privacy review permission, including for Super Admin." />
          )}
          <button
            className="button secondary"
            onClick={permission.refresh}
            disabled={permission.loading}
          >
            Refresh privacy permission
          </button>
        </>
      )}
      {session && allowed && (
        <PrivacyQueue
          staff={staff}
          userId={session.user.id}
          uncertain={uncertain}
          onUncertain={() => setUncertain(true)}
        />
      )}
    </>
  );
}
