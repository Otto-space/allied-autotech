"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import { draftIdentity } from "@/lib/forms/drafts";
import {
  privacyKinds,
  privacyStatuses,
  type PrivacyRequest,
} from "@/lib/api/privacy-schemas";
import {
  clearPrivacyPending,
  forgetPrivacyDrafts,
  markPrivacyPending,
  parsePrivacyHolds,
  parsePrivacyWorkPage,
  privacyPageParams,
  privacyQuery,
  privacySnapshot,
  readPrivacyPending,
  validatePrivacyChange,
  type PrivacyPending,
} from "@/lib/admin/work-privacy";
import { formatStockInstant } from "@/lib/admin/work-vehicle-detail";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { PrivacyRequestReview } from "./privacy-request-review";

export function WorkPrivacy() {
  const session = useAccountSession();
  if (!session) return null;
  return ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(session.user.role) ? (
    <PrivacyAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  ) : (
    <Feedback message="Staff privacy review permission is required." />
  );
}
function PrivacyAccess({ owner, role }: { owner: string; role: string }) {
  const access = useOwnStaffPermissions(),
    p = access.data,
    error =
      access.error ||
      access.refreshError ||
      (p &&
      (p.id !== owner ||
        p.role !== role ||
        p.status !== "ACTIVE" ||
        !p.capabilities.includes("PRIVACY_REVIEW"))
        ? "Privacy review requires an active privacy review permission, including for Super Admin."
        : undefined);
  if (!p || error)
    return (
      <div className="work-inspections work-privacy">
        <h1>Privacy review</h1>
        {error ? (
          <Feedback message={error} />
        ) : (
          <p role="status">Checking your privacy review permission…</p>
        )}
        <button
          className="button secondary"
          disabled={access.loading || access.refreshing}
          onClick={access.refresh}
        >
          Refresh privacy permission
        </button>
      </div>
    );
  return <PrivacyWorkspace owner={owner} role={role} refreshAccess={access.refresh} />;
}
function usePrivacyRows(path: string | null) {
  const parse = useCallback(
    (value: unknown) =>
      parsePrivacyWorkPage(value, new URLSearchParams(path?.split("?")[1])),
    [path],
  );
  return useResource(path, parse);
}
function PrivacyWorkspace({
  owner,
  role,
  refreshAccess,
}: {
  owner: string;
  role: string;
  refreshAccess: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    query = privacyQuery(new URLSearchParams(search.toString())),
    record = usePrivacyRows(query.path),
    active = useRef(true),
    request = useRef<AbortController | null>(null);
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<PrivacyPending | undefined>(() =>
      readPrivacyPending(owner, role),
    ),
    [message, setMessage] = useState<string>(),
    [tone, setTone] = useState<"error" | "success">("error"),
    [unavailable, setUnavailable] = useState(false),
    [checking, setChecking] = useState(false),
    [generation, setGeneration] = useState(0),
    [observed, setObserved] = useState<PrivacyRequest>();
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, []);
  const busy = record.loading || record.refreshing || checking,
    error = record.error || record.refreshError,
    rows = unavailable
      ? undefined
      : record.data?.items.map((r) =>
          observed?.id === r.id &&
          Date.parse(observed.reviewedAt ?? "1970-01-01") >=
            Date.parse(r.reviewedAt ?? "1970-01-01")
            ? observed
            : r,
        ),
    selected = query.params.get("request"),
    current = rows?.find((r) => r.id === selected),
    disabled = busy || !!error || !!pending || !!proposal || unavailable || query.invalid;
  const deny = useCallback(() => {
    setUnavailable(true);
    setObserved(undefined);
    refreshAccess();
  }, [refreshAccess, setUnavailable, setObserved]);
  function navigate(params: URLSearchParams) {
    router.push(`/admin/privacy${params.size ? `?${params}` : ""}`, { scroll: false });
  }
  function identity(signal: AbortSignal) {
    if (!active.current || signal.aborted || draftIdentity() !== `${owner}:${role}`)
      throw Error("Privacy review account changed");
  }
  async function freshAccess(signal: AbortSignal) {
    const p = parseOwnStaffProfile((await apiRequest("/staff/profile", { signal })).data);
    identity(signal);
    if (
      p.id !== owner ||
      p.role !== role ||
      p.status !== "ACTIVE" ||
      !p.capabilities.includes("PRIVACY_REVIEW")
    )
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
  }
  async function freshPage(signal: AbortSignal) {
    if (!query.path) throw Error("Reset invalid privacy filters first");
    const page = parsePrivacyWorkPage(
      (await apiRequest(query.path, { signal })).data,
      query.params,
    );
    identity(signal);
    return page;
  }
  function notSent() {
    const e = new ApiError(400, { error: { code: "REQUEST_FAILED" } });
    e.message =
      "No change was sent. Current permission, reviewed request, holds or recovery storage could not be confirmed. Your fields are kept; refresh and reload affected fields before reviewing again.";
    return e;
  }
  function review(offer: MutationProposal) {
    const change = offer.privacyChange;
    if (disabled || !current || !change || change.request.id !== current.id) return;
    const snapshot = privacySnapshot(current),
      url = window.location.href;
    let sent = false,
      marker: Exclude<PrivacyPending, "unknown"> | undefined;
    setMessage(undefined);
    setTone("error");
    setProposal({
      ...offer,
      retrySafely: false,
      retryAfterRejection: false,
      onUncertain: () => {
        if (sent && active.current)
          setPending(readPrivacyPending(owner, role) ?? "unknown");
      },
      submit: async () => {
        if (request.current || !active.current) throw notSent();
        const controller = new AbortController();
        request.current = controller;
        try {
          await freshAccess(controller.signal);
          const page = await freshPage(controller.signal),
            latest = page.items.find((r) => r.id === change.request.id);
          if (!latest || privacySnapshot(latest) !== snapshot) {
            if (latest) setObserved(latest);
            throw notSent();
          }
          const holds = parsePrivacyHolds(
            (
              await apiRequest(`/staff/retention-holds?userId=${latest.userId}`, {
                signal: controller.signal,
              })
            ).data,
            latest.userId,
          );
          identity(controller.signal);
          if (change.kind === "release") {
            const hold = holds.find((h) => h.id === change.hold?.id);
            if (
              !hold ||
              hold.releasedAt ||
              JSON.stringify(hold) !== JSON.stringify(change.hold)
            )
              throw notSent();
          }
          if (window.location.href !== url) throw notSent();
          marker = markPrivacyPending(owner, role, change);
          sent = true;
          setPending(marker);
          const response = await offer.submit();
          identity(controller.signal);
          const saved = validatePrivacyChange(response, change);
          if (saved.record) setObserved(saved.record);
          try {
            clearPrivacyPending(owner, role, marker.token);
            setPending(undefined);
          } catch {
            setPending(readPrivacyPending(owner, role) ?? "unknown");
          }
          setTone("success");
          setMessage(
            change.kind === "review"
              ? "Privacy review saved. No deletion or anonymization has been scheduled."
              : "Retention hold change recorded. Review the current protection status; no deletion or anonymization has been scheduled.",
          );
          record.refresh();
        } catch (e) {
          const submitted = sent;
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
          if (sent && e instanceof ApiError && [408, 429].includes(e.status))
            throw Error("Privacy outcome needs reconciliation");
          if (sent && e instanceof ApiError && e.status >= 400 && e.status < 500) {
            clearPrivacyPending(owner, role, marker!.token);
            sent = false;
            setPending(undefined);
          }
          if (!sent) {
            setPending(readPrivacyPending(owner, role));
            if (submitted) throw e;
            throw notSent();
          }
          throw e;
        } finally {
          request.current = null;
        }
      },
    });
  }
  async function reconcile() {
    if (request.current || proposal) return;
    const c = new AbortController();
    request.current = c;
    setChecking(true);
    setTone("error");
    setMessage(undefined);
    try {
      await freshAccess(c.signal);
      const page = await freshPage(c.signal),
        userId =
          pending && pending !== "unknown"
            ? pending.userId
            : page.items.find((r) => r.id === selected)?.userId;
      if (pending && !userId)
        throw Error("Select a current request to load account protection first");
      if (userId)
        parsePrivacyHolds(
          (
            await apiRequest(`/staff/retention-holds?userId=${userId}`, {
              signal: c.signal,
            })
          ).data,
          userId,
        );
      identity(c.signal);
      if (pending) {
        forgetPrivacyDrafts(owner, role);
        clearPrivacyPending(owner, role);
        setPending(undefined);
        setGeneration((v) => v + 1);
      }
      setObserved(undefined);
      setUnavailable(false);
      setTone("success");
      setMessage(
        "Current privacy requests and applicable account holds loaded. No change was resent; the previous request outcome is not proven. Unsaved page fields were replaced.",
      );
      record.refresh();
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) deny();
      if (active.current)
        setMessage(
          "Current privacy requests and account protection could not be confirmed. Select the relevant request if needed, check access and filters, then try again. No change was resent.",
        );
    } finally {
      request.current = null;
      if (active.current) setChecking(false);
    }
  }
  return (
    <div
      className="work-inspections work-privacy"
      data-privacy-owner={`${owner}:${role}`}
    >
      <nav className="wi-breadcrumb" aria-label="Breadcrumb">
        <Link href="/admin">Overview</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">Privacy review</span>
      </nav>
      <header className="wi-header">
        <div>
          <h1>Privacy review</h1>
          <p>
            Review customer requests and account protection. Responses are visible to the
            customer.
          </p>
        </div>
        <div className="wpr-actions">
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={refreshAccess}
          >
            Refresh privacy permission
          </button>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => (unavailable ? void reconcile() : record.refresh())}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh privacy requests
          </button>
        </div>
      </header>
      <p className="wpr-guidance">
        <strong>Review decisions only.</strong> Approval does not delete or anonymize
        customer information or schedule destructive work.
      </p>
      <Feedback message={message} tone={tone} />
      {pending && (
        <section className="wi-state">
          <h2>A privacy change needs reconciliation</h2>
          <p>
            Load the current request page and applicable account holds before making
            another change. This replaces unsaved page fields without resending or proving
            the original outcome. If the stored reference is unavailable, select the
            relevant request first.
          </p>
          <button
            className="button secondary"
            disabled={busy || !!proposal}
            onClick={() => void reconcile()}
          >
            Load current privacy records
          </button>
        </section>
      )}
      <PrivacyFilters
        key={`${query.params.get("kind")}:${query.params.get("status")}:${query.params.get("userId")}`}
        params={query.params}
        disabled={busy || !!proposal}
        navigate={navigate}
      />
      {query.invalid ? (
        <section className="wi-state">
          <h2>Privacy filters unavailable</h2>
          <p>This link contains unsupported or invalid privacy filters.</p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Reset privacy filters
          </button>
        </section>
      ) : (
        <>
          {busy && (
            <p className="wi-state" role="status">
              {rows ? "Refreshing privacy requests…" : "Loading privacy requests…"}
            </p>
          )}
          {(error || unavailable) && (
            <section className="wi-state">
              <Feedback
                message={
                  error ??
                  "Privacy records are unavailable under your current permission."
                }
              />
              {rows && (
                <p>
                  Previously loaded requests are shown. Changes remain disabled until a
                  fresh read succeeds.
                </p>
              )}
              <button
                className="button secondary"
                disabled={busy || !!proposal}
                onClick={() => (unavailable ? void reconcile() : record.refresh())}
              >
                Retry privacy requests
              </button>
            </section>
          )}
          {rows && (
            <>
              <div className="wpr-page">
                <h2>Requests for review</h2>
                <p>
                  {rows.length} {rows.length === 1 ? "record" : "records"} on this page ·
                  Newest first
                </p>
              </div>
              {!rows.length && (
                <section className="wi-state">
                  <h3>No privacy requests on this page</h3>
                  <p>
                    Clear filters or return to the first page to review other recorded
                    requests.
                  </p>
                </section>
              )}
              {selected && !current && (
                <section className="wi-state">
                  <p>
                    The selected request is not on this page. Select a current request or
                    return to its page before reviewing.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      const p = new URLSearchParams(query.params);
                      p.delete("request");
                      navigate(p);
                    }}
                  >
                    Clear selected request
                  </button>
                </section>
              )}
              <div key={generation} className="wpr-records">
                {rows.map((row) => (
                  <article className="wi-card privacy-record wpr-record" key={row.id}>
                    <div className="wpr-record-head">
                      <div>
                        <h2>{privacyKinds[row.kind]}</h2>
                        <strong className="status">{privacyStatuses[row.status]}</strong>
                      </div>
                      <button
                        className="button secondary"
                        aria-expanded={selected === row.id}
                        disabled={busy || !!proposal}
                        onClick={() => {
                          const p = new URLSearchParams(query.params);
                          if (selected === row.id) p.delete("request");
                          else p.set("request", row.id);
                          navigate(p);
                        }}
                      >
                        {selected === row.id ? "Hide review" : "Review request"}
                      </button>
                    </div>
                    <dl className="wpr-facts">
                      {[
                        { label: "Request reference", value: row.id },
                        { label: "Account reference", value: row.userId },
                        { label: "Requested", value: formatStockInstant(row.createdAt) },
                        {
                          label: "Reviewed",
                          value: row.reviewedAt
                            ? formatStockInstant(row.reviewedAt)
                            : "Not reviewed",
                        },
                      ].map((f) => (
                        <div key={f.label}>
                          <dt>{f.label}</dt>
                          <dd>{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <h3>Customer explanation</h3>
                    <p className="preserve-lines">{row.reason}</p>
                    {row.reviewNote !== null && (
                      <div className="wpr-saved-response">
                        <h3>Customer-visible review response</h3>
                        <p className="preserve-lines">{row.reviewNote}</p>
                      </div>
                    )}
                    {selected === row.id && (
                      <div className="wpr-workspace">
                        <PrivacyRequestReview
                          record={row}
                          disabled={disabled}
                          onSaved={() => {}}
                          onUncertain={() => {}}
                          onReview={review}
                          onDenied={deny}
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <nav className="wi-pagination" aria-label="Privacy requests pages">
                <button
                  className="button secondary"
                  disabled={!query.params.has("cursor") || busy || !!proposal}
                  onClick={() =>
                    navigate(privacyPageParams(query.params, undefined, true))
                  }
                >
                  Previous
                </button>
                {query.params.has("cursor") && (
                  <button
                    className="button secondary"
                    disabled={busy || !!proposal}
                    onClick={() => {
                      const p = new URLSearchParams(query.params);
                      p.delete("cursor");
                      p.delete("_trail");
                      p.delete("request");
                      navigate(p);
                    }}
                  >
                    First page
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={!record.data?.nextCursor || busy || !!error || !!proposal}
                  onClick={() => {
                    const p = privacyPageParams(query.params, record.data?.nextCursor);
                    p.delete("request");
                    navigate(p);
                  }}
                >
                  Next
                </button>
              </nav>
            </>
          )}
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel={
            proposal.privacyChange?.kind === "review"
              ? "Save privacy review"
              : "Confirm hold change"
          }
          onClose={() => {
            setProposal(null);
            record.refresh();
          }}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
function PrivacyFilters({
  params,
  disabled,
  navigate,
}: {
  params: URLSearchParams;
  disabled: boolean;
  navigate: (p: URLSearchParams) => void;
}) {
  const [error, setError] = useState<string>();
  return (
    <form
      className="wi-filters wpr-filters"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        const values = new FormData(event.currentTarget),
          p = new URLSearchParams(),
          userId = String(values.get("userId") ?? "").trim();
        if (userId && !z.uuid().safeParse(userId).success) {
          setError("Enter an exact account UUID or leave the filter empty.");
          event.currentTarget
            .querySelector<HTMLInputElement>("#privacy-account")
            ?.focus();
          return;
        }
        for (const key of ["kind", "status"]) {
          const v = String(values.get(key) ?? "");
          if (v) p.set(key, v);
        }
        if (userId) p.set("userId", userId.toLowerCase());
        setError(undefined);
        navigate(p);
      }}
    >
      <fieldset disabled={disabled}>
        <legend className="sr-only">Filter privacy requests</legend>
        <div className="field">
          <label htmlFor="privacy-kind">Request type</label>
          <select id="privacy-kind" name="kind" defaultValue={params.get("kind") ?? ""}>
            <option value="">All requests</option>
            {Object.entries(privacyKinds).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="privacy-status">Review status</label>
          <select
            id="privacy-status"
            name="status"
            defaultValue={params.get("status") ?? ""}
          >
            <option value="">All statuses</option>
            {Object.entries(privacyStatuses).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="privacy-account">Account reference</label>
          <input
            id="privacy-account"
            name="userId"
            maxLength={36}
            defaultValue={params.get("userId") ?? ""}
            aria-describedby="privacy-account-error"
            aria-invalid={!!error}
          />
          <p id="privacy-account-error" className="field-error">
            {error}
          </p>
        </div>
        <div className="wpr-actions">
          <button className="button">Apply privacy filters</button>
          <button
            className="button secondary"
            type="button"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear filters
          </button>
        </div>
      </fieldset>
    </form>
  );
}
