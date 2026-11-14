"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import {
  workforceReviewKindSchema,
  workforceDirectoryQuerySchema,
  parseWorkforceReview,
  type WorkforceReviewKind,
} from "@/lib/api/workforce-directory-schemas";
import { workforceTemplateLabels } from "@/lib/api/workforce-schemas";
import { workforcePositionLabels } from "@/lib/api/workforce-positions";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { AdminBranchPicker } from "./admin-branch-picker";
import { Feedback } from "./feedback";
import "./workforce-directory.css";
import "./workforce-access-reviews.css";

const base = "/admin/workforce/reviews";
export const accessReviewLabels: Record<WorkforceReviewKind, string> = {
  COVER_ENDING: "Temporary cover ending soon",
  OPEN_ENDED_COVER: "Temporary cover without an end date",
  SCHEDULED: "Scheduled duties",
  ENDED: "Ended duties",
  REMOVED: "Removed duties",
  UNASSIGNED: "Staff without active duties in this scope",
  EARLIER_STAFF_SETUP: "Staff using an earlier access setup",
};
const reviewOptions: Record<WorkforceReviewKind, string> = {
  COVER_ENDING: "Cover ending soon",
  OPEN_ENDED_COVER: "Cover without end date",
  SCHEDULED: "Scheduled duties",
  ENDED: "Ended duties",
  REMOVED: "Removed duties",
  UNASSIGNED: "Staff: no active scoped duties",
  EARLIER_STAFF_SETUP: "Staff: earlier access setup",
};
const querySchema = z
  .strictObject({
    review: workforceReviewKindSchema.default("COVER_ENDING"),
    reviewDays: z.enum(["1", "7", "30"]).optional(),
    q: workforceDirectoryQuerySchema.shape.q,
    branchId: workforceDirectoryQuerySchema.shape.branchId,
    cursor: workforceDirectoryQuerySchema.shape.cursor,
  })
  .refine((v) => v.reviewDays === undefined || v.review === "COVER_ENDING");

export function WorkforceAccessReviews() {
  return (
    <Suspense fallback={<p role="status">Loading access reviews…</p>}>
      <ReviewEntry />
    </Suspense>
  );
}
function ReviewEntry() {
  const search = useSearchParams();
  return <Reviews key={search.toString()} />;
}
function Reviews() {
  const search = useSearchParams(),
    router = useRouter(),
    session = useAccountSession();
  const owner = session?.user.role === "SUPER_ADMIN";
  const parsed = querySchema.safeParse(Object.fromEntries(search));
  const kind = String(
    parsed.success ? parsed.data.review : "COVER_ENDING",
  ) as WorkforceReviewKind;
  const days = Number(parsed.success ? (parsed.data.reviewDays ?? 7) : 7) as 1 | 7 | 30;
  const [choice, setChoice] = useState<WorkforceReviewKind>(kind);
  const [branch, setBranch] = useState(
    parsed.success ? (parsed.data.branchId ?? "") : "",
  );
  const query = new URLSearchParams();
  if (parsed.success) {
    query.set("review", kind);
    if (kind === "COVER_ENDING") query.set("reviewDays", String(days));
    for (const key of ["q", "branchId", "cursor"] as const)
      if (parsed.data[key]) query.set(key, parsed.data[key]);
  }
  const parse = useCallback(
    (value: unknown) => parseWorkforceReview(value, kind, owner, days),
    [kind, owner, days],
  );
  const records = useResource(
    parsed.success ? `/admin/workforce/accounts?${query}` : null,
    parse,
  );
  const error = records.error || records.refreshError,
    data = records.data;
  const href = (params: URLSearchParams) => `${base}?${params}`;
  const first = new URLSearchParams(query);
  first.delete("cursor");
  return (
    <section className="workforce-directory workforce-reviews">
      <div className="wf-directory-heading">
        <div>
          <h1>Access reviews</h1>
          <p>Find dated duties and staff access setups that need a closer look.</p>
        </div>
        <button
          className="button secondary"
          onClick={records.refresh}
          disabled={!parsed.success || records.loading || records.refreshing}
        >
          Refresh review
        </button>
      </div>
      <p>
        Reviews do not change access or send reminders. Open a person before deciding on a
        change.
      </p>
      <form
        className="wf-directory-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget),
            next = new URLSearchParams({ review: choice });
          if (choice === "COVER_ENDING")
            next.set("reviewDays", String(form.get("reviewDays")));
          const q = String(form.get("q") ?? "").trim();
          if (q) next.set("q", q);
          if (branch) next.set("branchId", branch);
          router.push(href(next));
        }}
      >
        <div className="wf-directory-filter-grid">
          <div>
            <label htmlFor="access-review-kind">Review</label>
            <select
              id="access-review-kind"
              value={choice}
              onChange={(event) => setChoice(event.target.value as WorkforceReviewKind)}
            >
              {workforceReviewKindSchema.options.map((value) => (
                <option key={value} value={value}>
                  {reviewOptions[value]}
                </option>
              ))}
            </select>
          </div>
          {choice === "COVER_ENDING" && (
            <div>
              <label htmlFor="access-review-days">Ending within</label>
              <select id="access-review-days" name="reviewDays" defaultValue={days}>
                <option value="1">The next 24 hours</option>
                <option value="7">The next 7 days</option>
                <option value="30">The next 30 days</option>
              </select>
            </div>
          )}
          <div>
            <label htmlFor="access-review-search">Person name or email</label>
            <input
              id="access-review-search"
              name="q"
              maxLength={120}
              defaultValue={parsed.success ? (parsed.data.q ?? "") : ""}
            />
          </div>
          <div>
            <label htmlFor="access-review-branch">Account branch</label>
            {owner ? (
              <AdminBranchPicker
                id="access-review-branch"
                value={branch}
                onChange={setBranch}
                activeOnly={false}
              />
            ) : (
              <>
                <select
                  id="access-review-branch"
                  value={branch}
                  onChange={(event) => setBranch(event.target.value)}
                  disabled={!data?.managementBranches || !!error || records.loading}
                >
                  <option value="">All permitted branches</option>
                  {data?.managementBranches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {!b.isActive && " (inactive)"}
                    </option>
                  ))}
                  {branch && !data?.managementBranches?.some((b) => b.id === branch) && (
                    <option value={branch}>Selected branch unavailable</option>
                  )}
                </select>
              </>
            )}
          </div>
          <button className="button" disabled={records.loading}>
            Apply review
          </button>
          <Link className="button secondary" href={base}>
            Reset review
          </Link>
        </div>
      </form>
      {!parsed.success && (
        <Feedback message="A review filter is invalid. Reset the review to check permitted people." />
      )}
      <Feedback message={error} />
      {records.loading ? (
        <p role="status">Checking the current permitted records…</p>
      ) : (
        parsed.success &&
        data &&
        !error && (
          <>
            <h2>{accessReviewLabels[kind]}</h2>
            <p>
              {owner
                ? "Accounts and supported duties you are permitted to manage."
                : "Staff accounts in your delegated branches, showing only the duties you are permitted to manage."}{" "}
              Checked {formatBusinessDate(data.generatedAt)}.
              {data.review?.windowEndsAt &&
                ` Window ends ${formatBusinessDate(data.review.windowEndsAt)}.`}
            </p>
            {kind === "UNASSIGNED" && (
              <p>
                This review includes active, verified Staff accounts using managed duties.
                Other duties outside your scope, separately approved permissions and
                account-level access may still apply. Administrators and the protected
                owner baseline are excluded.
              </p>
            )}
            {kind === "EARLIER_STAFF_SETUP" && (
              <p>
                These Staff accounts keep their earlier account-level access. This is a
                review list, not a requirement to enroll them or give them duties. A job
                title alone grants no permissions.
              </p>
            )}
            {kind === "OPEN_ENDED_COVER" && (
              <p>
                Existing cover is unchanged. Some records may be scheduled or attached to
                inactive accounts or branches; inspect the dates and current status before
                deciding what to do.
              </p>
            )}
            {(kind === "ENDED" || kind === "REMOVED" || kind === "SCHEDULED") && (
              <p>
                These are recorded duties, not a statement that the person has no other
                access. Scheduled duties do not supply access before their start; ended or
                removed duties do not supply access.
              </p>
            )}
            <p role="status">
              {data.items.length} {data.items.length === 1 ? "person" : "people"} on this
              page
            </p>
            {data.items.length ? (
              <ul className="wf-review-people">
                {data.items.map((person) => (
                  <li className="detail-section" key={person.userId}>
                    <div className="wf-review-person">
                      <div>
                        <h3>{person.name}</h3>
                        {person.name !== person.email && <p>{person.email}</p>}
                        <p>
                          {person.role === "SUPER_ADMIN"
                            ? "Super Admin"
                            : person.role === "ADMIN"
                              ? "Admin"
                              : "Staff"}{" "}
                          ·{" "}
                          {person.status === "ACTIVE"
                            ? "Active"
                            : person.status === "SUSPENDED"
                              ? "Suspended"
                              : "Deactivated"}
                          {!person.verified && " · Email not verified"}
                        </p>
                        <p>
                          {person.position
                            ? workforcePositionLabels[person.position]
                            : person.managed
                              ? "Position needs review"
                              : "Earlier staff access setup"}
                          {person.accountBranch &&
                            ` · ${person.accountBranch.name}${person.accountBranch.isActive ? "" : " (inactive branch)"}`}
                        </p>
                      </div>
                      <Link
                        className="button secondary"
                        href={`/admin/workforce/access/${person.userId}?${query}`}
                        aria-label={`View person: ${person.name}`}
                      >
                        View person
                      </Link>
                    </div>
                    {person.reviewMatches!.map((assignment) => (
                      <section className="wf-review-duty" key={assignment.assignmentId}>
                        <h4>
                          {workforceTemplateLabels[assignment.template]}
                          {assignment.temporary && " · Temporary cover"}
                        </h4>
                        <p>
                          {assignment.branch.name}
                          {!assignment.branch.isActive && " (inactive branch)"} ·{" "}
                          {assignment.scope === "ASSIGNED"
                            ? "Assigned records"
                            : "Branch records"}
                        </p>
                        <dl className="wf-review-dates">
                          <div>
                            <dt>Starts</dt>
                            <dd>{formatBusinessDate(assignment.startsAt)}</dd>
                          </div>
                          <div>
                            <dt>Ends</dt>
                            <dd>
                              {assignment.expiresAt
                                ? formatBusinessDate(assignment.expiresAt)
                                : "No end date recorded"}
                            </dd>
                          </div>
                          {assignment.revokedAt && (
                            <div>
                              <dt>Removed</dt>
                              <dd>{formatBusinessDate(assignment.revokedAt)}</dd>
                            </div>
                          )}
                        </dl>
                      </section>
                    ))}
                    {person.reviewMatchesMore && (
                      <p>
                        More matching records are available in the person’s access
                        details.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No people match this review within your current management scope.</p>
            )}
            <nav className="wf-directory-actions" aria-label="Access review pages">
              {query.has("cursor") && (
                <Link className="button secondary" href={href(first)}>
                  First page
                </Link>
              )}
              {data.nextCursor && (
                <Link
                  className="button secondary"
                  href={href(
                    new URLSearchParams({
                      ...Object.fromEntries(query),
                      cursor: data.nextCursor,
                    }),
                  )}
                >
                  Next page
                </Link>
              )}
            </nav>
          </>
        )
      )}
      <p>
        <Link href="/admin/workforce/access">People</Link>
        {owner && (
          <>
            {" "}
            · <Link href="/admin/staff/invite">Review invitation status</Link>
          </>
        )}
      </p>
    </section>
  );
}
