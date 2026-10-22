"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError, apiRequest } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { parseOwnStaffProfile } from "@/lib/api/capability-schemas";
import {
  branchSchema,
  branchFormSchema,
  branchQuery,
  branchPageParams,
  parseBranchPage,
  branchValues,
  branchBody,
  verifyBranchReceipt,
  branchLabels,
  type WorkBranch,
  type BranchValues,
} from "@/lib/admin/work-branches";
import {
  readBranchPending,
  markBranchPending,
  clearBranchPending,
  type BranchPending,
} from "@/lib/admin/work-branch-pending";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession, useOwnStaffPermissions } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";

export function BranchesWorkspace() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Branches</h1>
        <Feedback message="Administrator access is required to manage branches." />
      </>
    );
  return (
    <BranchAccess
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
      role={session.user.role}
    />
  );
}
function BranchAccess({ owner, role }: { owner: string; role: string }) {
  const own = useOwnStaffPermissions(),
    [denied, setDenied] = useState(false);
  const deny = useCallback(() => setDenied(true), []);
  const error =
    own.error ||
    own.refreshError ||
    (own.data &&
    (own.data.id !== owner || own.data.role !== role || own.data.status !== "ACTIVE")
      ? "Current branch-management access could not be confirmed."
      : undefined);
  if (!own.data || error || denied)
    return (
      <div className="work-branches">
        <h1>Branches</h1>
        <Feedback
          message={
            error ||
            (denied
              ? "Branch access is unavailable. Protected records have been cleared."
              : undefined)
          }
        />
        {own.loading && <p role="status">Checking branch access…</p>}
        <button
          className="button secondary"
          disabled={own.loading || own.refreshing}
          onClick={() => {
            setDenied(false);
            own.refresh();
          }}
        >
          Refresh branch access
        </button>
      </div>
    );
  return (
    <BranchContent
      owner={owner}
      role={role}
      accessBusy={own.loading || own.refreshing}
      onDenied={deny}
    />
  );
}
function BranchContent({
  owner,
  role,
  accessBusy,
  onDenied,
}: {
  owner: string;
  role: string;
  accessBusy: boolean;
  onDenied: () => void;
}) {
  const router = useRouter(),
    search = useSearchParams(),
    view = branchQuery(new URLSearchParams(search.toString())),
    paramsText = view.params.toString();
  const [navigating, startNavigation] = useTransition();
  const navigate = useCallback(
    (params: URLSearchParams) =>
      startNavigation(() =>
        router.push(`/admin/branches${params.size ? `?${params}` : ""}`, {
          scroll: false,
        }),
      ),
    [router],
  );
  const listParams = view.path?.split("?")[1] ?? "";
  const parsePage = useCallback(
    (value: unknown) => parseBranchPage(value, new URLSearchParams(listParams)),
    [listParams],
  );
  const records = useResource(view.path, parsePage);
  const parseSelected = useCallback(
    (value: unknown) => {
      const row = branchSchema.parse(value);
      if (row.id !== view.selected) throw Error("Unexpected branch");
      return row;
    },
    [view.selected],
  );
  const selected = useResource(
    view.selected ? `/admin/branches/${view.selected}` : null,
    parseSelected,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null),
    [pending, setPending] = useState<BranchPending>(),
    [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string>(),
    [error, setError] = useState<string>(),
    [epoch, setEpoch] = useState(0);
  const [lastSaved, setLastSaved] = useState<WorkBranch>();
  const currentRecord = selected.denied
    ? undefined
    : lastSaved?.id === view.selected &&
        (!selected.data ||
          Date.parse(lastSaved.updatedAt) > Date.parse(selected.data.updatedAt))
      ? lastSaved
      : selected.data;
  const [checking, setChecking] = useState(false),
    [inspected, setInspected] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const mounted = useRef(true),
    statusRef = useRef<HTMLParagraphElement>(null),
    editorRef = useRef<HTMLElement>(null);
  const discard = useCallback(() => {
    setProposal(null);
    setMessage(undefined);
    setError(undefined);
  }, []);
  const mutation = useAccountMutation(discard);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => {
      if (mounted.current) {
        setPending(readBranchPending(owner, role));
        setReady(true);
      }
    });
    return () => {
      mounted.current = false;
    };
  }, [owner, role]);
  useEffect(() => {
    if (records.denied || selected.denied) onDenied();
  }, [records.denied, selected.denied, onDenied]);
  useEffect(() => {
    if (message) statusRef.current?.focus();
  }, [message]);
  const editorOpen = !!view.selected || view.creating;
  useEffect(() => {
    if (editorOpen) editorRef.current?.focus();
  }, [editorOpen, view.selected]);
  const refresh = () => {
    records.refresh();
    selected.refresh();
  };
  const busy = mutation.busy || !!proposal || checking;
  const locked =
    busy ||
    navigating ||
    accessBusy ||
    !ready ||
    !!pending ||
    mutation.sessionChanged ||
    view.invalid;
  const listError = records.error || records.refreshError;
  const recordError = selected.error || selected.refreshError;
  const syncPending = () => {
    if (mounted.current) setPending(readBranchPending(owner, role));
  };
  function closeEditor() {
    const next = new URLSearchParams(view.params);
    next.delete("branch");
    next.delete("create");
    navigate(next);
  }
  function openEditor(id?: string) {
    const next = new URLSearchParams(view.params);
    next.delete("branch");
    next.delete("create");
    next.set(id ? "branch" : "create", id ?? "1");
    setMessage(undefined);
    navigate(next);
  }
  const changeFilter = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(paramsText);
      for (const k of ["cursor", "_trail", "branch", "create"]) next.delete(k);
      if (value) next.set(key, value);
      else next.delete(key);
      navigate(next);
    },
    [navigate, paramsText],
  );
  const searchBranches = useCallback(
    (value: string) => changeFilter("q", value),
    [changeFilter],
  );
  async function currentActor(signal?: AbortSignal) {
    const actor = parseOwnStaffProfile(
      (await apiRequest("/staff/profile", { signal })).data,
    );
    if (actor.id !== owner || actor.role !== role || actor.status !== "ACTIVE") {
      onDenied();
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    }
  }
  function review(values: BranchValues, before?: WorkBranch) {
    if (locked || (before && (recordError || selected.loading || selected.refreshing)))
      return;
    const body = branchBody(values, before);
    if (!Object.keys(body).length) {
      setMessage("No branch details have changed.");
      return;
    }
    setError(undefined);
    setMessage(undefined);
    setInspected(false);
    setAcknowledged(false);
    setProposal({
      title: before ? "Save these branch changes?" : "Create this branch?",
      description:
        "These details affect workshop information and public branch selection. Inactive branches remain in administrative history. Active branch staff must be reassigned or deactivated before the branch can be deactivated.",
      facts: Object.entries(body)
        .filter(([key]) => key !== "expectedRevision")
        .map(([key, value]) => ({
          label: branchLabels[key] ?? key,
          value:
            key === "isActive"
              ? value
                ? "Active"
                : "Inactive"
              : value === null
                ? "Not provided (clear existing value)"
                : String(value),
        })),
      retryAfterRejection: false,
      onUncertain: syncPending,
      submit: async () => {
        const controller = mutation.begin();
        if (!controller)
          throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
        let marker: Exclude<BranchPending, "unknown"> | undefined;
        try {
          try {
            await currentActor(controller.signal);
            if (before) {
              const latest = branchSchema.parse(
                (
                  await apiRequest(`/admin/branches/${before.id}`, {
                    signal: controller.signal,
                  })
                ).data,
              );
              if (JSON.stringify(latest) !== JSON.stringify(before))
                throw new ApiError(409, { error: { code: "STALE_VERSION" } });
            }
          } catch (e) {
            refresh();
            if (e instanceof ApiError && e.status >= 400 && e.status < 500) throw e;
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
          }
          try {
            marker = markBranchPending(
              owner,
              role,
              before
                ? { kind: "update", target: before.id }
                : { kind: "create", code: values.code },
            );
            syncPending();
          } catch {
            syncPending();
            throw new ApiError(409, { error: { code: "PRECONDITION_UNAVAILABLE" } });
          }
          const saved = verifyBranchReceipt(
            (
              await apiRequest(
                before ? `/admin/branches/${before.id}` : "/admin/branches",
                {
                  method: before ? "PATCH" : "POST",
                  body,
                  csrf: true,
                  signal: controller.signal,
                },
              )
            ).data,
            body,
            before,
          );
          if (controller.signal.aborted) throw Error("Account changed");
          clearBranchPending(owner, role, marker.token);
          syncPending();
          setLastSaved(saved);
          setEpoch((v) => v + 1);
          setMessage(before ? "Branch changes saved." : "Branch created.");
          const next = new URLSearchParams(view.params);
          next.delete("create");
          next.set("branch", saved.id);
          navigate(next);
          refresh();
        } catch (e) {
          if (marker && e instanceof ApiError && e.status >= 400 && e.status < 500) {
            clearBranchPending(owner, role, marker.token);
            syncPending();
          }
          throw e;
        } finally {
          mutation.finish(controller);
        }
      },
    });
  }
  async function inspectPending() {
    if (!pending || busy || accessBusy) return;
    setChecking(true);
    setInspected(false);
    setAcknowledged(false);
    setError(undefined);
    try {
      await currentActor();
      if (pending !== "unknown" && pending.kind === "update") {
        const row = branchSchema.parse(
          (await apiRequest(`/admin/branches/${pending.target}`)).data,
        );
        if (row.id !== pending.target) throw Error("Unexpected branch");
        setMessage(
          `Current branch: ${row.name} (${row.isActive ? "active" : "inactive"}).`,
        );
      } else {
        const query = new URLSearchParams({ limit: "25" });
        if (pending !== "unknown") query.set("code", pending.code);
        const page = parseBranchPage(
          (await apiRequest(`/admin/branches?${query}`)).data,
          query,
        );
        if (pending !== "unknown")
          setMessage(
            page.items.length
              ? `A branch with code ${pending.code} is currently recorded. Independently confirm the original request.`
              : `No branch with code ${pending.code} is currently recorded. Independently confirm the original request.`,
          );
      }
      if (mounted.current) {
        setInspected(true);
        refresh();
      }
    } catch {
      if (mounted.current)
        setError(
          "Current branch information could not be checked. Keep the change locked and try again.",
        );
    } finally {
      if (mounted.current) setChecking(false);
    }
  }
  function reconcile() {
    if (!pending || !inspected || !acknowledged || busy || accessBusy) return;
    try {
      clearBranchPending(owner, role, pending === "unknown" ? undefined : pending.token);
      syncPending();
      setInspected(false);
      setAcknowledged(false);
      setEpoch((v) => v + 1);
      setMessage(
        "Reconciliation recorded on this device. Review current branch details before another change.",
      );
      refresh();
    } catch {
      setError("The pending change could not be cleared safely. Changes remain locked.");
    }
  }
  const pageDisabled =
    busy || navigating || records.loading || records.refreshing || !!listError;
  return (
    <div className={`work-branches${editorOpen ? " wb-editing" : ""}`}>
      <nav className="wb-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">Branches</span>
          </li>
        </ol>
      </nav>
      <header className="wb-heading">
        <div>
          <h1>Branches</h1>
          <p>Manage workshop locations and their public contact details.</p>
        </div>
        <button className="button" disabled={locked} onClick={() => openEditor()}>
          <Plus size={17} aria-hidden="true" />
          Add branch
        </button>
      </header>
      {message && (
        <p className="notice" role="status" tabIndex={-1} ref={statusRef}>
          {message}
        </p>
      )}
      {pending && !proposal && (
        <section className="wb-recovery" aria-labelledby="branch-recovery-title">
          <h2 id="branch-recovery-title">Check the previous branch change</h2>
          <p>
            The outcome could not be confirmed. Changes remain locked after reload and no
            request will be resent automatically.
          </p>
          <p>
            Check current information and independently reconcile the original action with
            audit history or the responsible administrator. A matching branch does not
            prove the original request completed.
          </p>
          {pending === "unknown" && (
            <p>
              The original reference is unavailable on this device. Identify the branch
              and action in audit history before unlocking.
            </p>
          )}
          <Feedback message={error} />
          <button
            className="button secondary"
            disabled={checking || accessBusy}
            onClick={() => void inspectPending()}
          >
            {checking
              ? "Checking branch information…"
              : "Check current branch information"}
          </button>
          {inspected && (
            <div>
              <p role="status">
                Current information was checked. Complete the independent review before
                unlocking.
              </p>
              <label className="wb-check">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                I independently reconciled the previous change and am ready to review a
                new action.
              </label>
              <button
                className="button secondary"
                disabled={!acknowledged || checking || accessBusy}
                onClick={reconcile}
              >
                Finish reconciliation
              </button>
            </div>
          )}
        </section>
      )}
      {view.invalid ? (
        <>
          <Feedback message="This branch view contains invalid or unsupported filters." />
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear branch filters
          </button>
        </>
      ) : (
        <>
          <div className="wb-toolbar">
            <BranchSearch
              value={view.params.get("q") ?? ""}
              disabled={busy}
              onSearch={searchBranches}
            />
            <div className="field">
              <label htmlFor="branch-status">Branch status</label>
              <select
                id="branch-status"
                value={view.params.get("isActive") ?? ""}
                disabled={busy || navigating}
                onChange={(e) => changeFilter("isActive", e.target.value)}
              >
                <option value="">All branches</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <button
              className="button secondary"
              disabled={busy || records.loading || records.refreshing}
              onClick={refresh}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Refresh branches
            </button>
          </div>
          <div className="wb-columns">
            <section className="wb-records" aria-label="Branch records">
              <Feedback message={listError} />
              {records.refreshError && records.data && (
                <p className="notice">
                  Previously loaded branches are shown. Refresh successfully before using
                  these records.
                </p>
              )}
              {records.loading && <p role="status">Loading branches…</p>}
              {!records.loading && !records.error && records.data && (
                <>
                  <p className="wb-count" role="status">
                    {records.data.items.length} on this page
                  </p>
                  {records.data.items.length === 0 ? (
                    <div className="wb-empty">
                      <h2>No branches match this view</h2>
                      <p>Change the search or status filter, or add a branch.</p>
                      <button
                        className="button secondary"
                        onClick={() => navigate(new URLSearchParams())}
                      >
                        Clear branch filters
                      </button>
                    </div>
                  ) : (
                    records.data.items.map((row) => (
                      <article
                        className={`wb-row${view.selected === row.id ? " wb-selected" : ""}`}
                        key={row.id}
                      >
                        <div>
                          <h2>
                            <button
                              className="wb-select"
                              disabled={busy || !!listError}
                              onClick={() => openEditor(row.id)}
                              aria-current={view.selected === row.id ? "true" : undefined}
                            >
                              {row.name}
                              <ChevronRight size={16} aria-hidden="true" />
                            </button>
                          </h2>
                          <p className="wb-code">{row.code}</p>
                          <p>
                            {row.city}, {row.state}
                          </p>
                          <div className="wb-contact">
                            {row.phone ? (
                              <a href={`tel:${row.phone.replace(/[^+0-9]/g, "")}`}>
                                {row.phone}
                              </a>
                            ) : (
                              <span>No public phone</span>
                            )}
                            {row.email ? (
                              <a href={`mailto:${row.email}`}>{row.email}</a>
                            ) : (
                              <span>No public email</span>
                            )}
                          </div>
                        </div>
                        <span className={`wb-status${row.isActive ? " wb-active" : ""}`}>
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                      </article>
                    ))
                  )}
                </>
              )}
              <nav className="pagination" aria-label="Branches pages">
                <button
                  className="button secondary"
                  disabled={!view.params.has("cursor") || pageDisabled}
                  onClick={() => navigate(branchPageParams(view.params, undefined, true))}
                >
                  Previous
                </button>
                <span>
                  {view.params.has("_trail")
                    ? `Page ${view.params.get("_trail")!.split(",").length + 1}`
                    : view.params.has("cursor")
                      ? "Current page"
                      : "Page 1"}
                </span>
                <button
                  className="button secondary"
                  disabled={!records.data?.nextCursor || pageDisabled}
                  onClick={() =>
                    navigate(branchPageParams(view.params, records.data?.nextCursor))
                  }
                >
                  Next
                </button>
              </nav>
            </section>
            {editorOpen && (
              <section
                ref={editorRef}
                tabIndex={-1}
                className="wb-editor"
                aria-label="Branch editor"
              >
                <button
                  className="wb-back text-link"
                  disabled={busy}
                  onClick={closeEditor}
                >
                  Back to branch list
                </button>
                <Feedback message={recordError} />
                {selected.loading && !currentRecord && (
                  <p role="status">Loading selected branch…</p>
                )}
                {recordError && (
                  <button className="button secondary" onClick={selected.refresh}>
                    Retry selected branch
                  </button>
                )}
                {view.creating || currentRecord ? (
                  <BranchEditor
                    key={`${view.selected ?? "create"}:${epoch}`}
                    record={view.creating ? undefined : currentRecord}
                    disabled={
                      locked || !!recordError || selected.loading || selected.refreshing
                    }
                    onClose={closeEditor}
                    onReview={review}
                  />
                ) : null}
              </section>
            )}
          </div>
        </>
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
function BranchSearch({
  value,
  disabled,
  onSearch,
}: {
  value: string;
  disabled: boolean;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value),
    [error, setError] = useState<string>();
  useEffect(() => {
    queueMicrotask(() => setDraft(value));
  }, [value]);
  useEffect(() => {
    const text = draft.trim();
    if (
      disabled ||
      text === value ||
      (text.length > 0 && text.length < 2) ||
      text.length > 100
    )
      return;
    const timer = setTimeout(() => onSearch(text), 400);
    return () => clearTimeout(timer);
  }, [draft, value, disabled, onSearch]);
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const text = draft.trim();
        if (text && (text.length < 2 || text.length > 100)) {
          setError("Use 2–100 characters, or clear the search.");
          return;
        }
        setError(undefined);
        onSearch(text);
      }}
    >
      <div className="field">
        <label htmlFor="branch-search">Search branches</label>
        <input
          id="branch-search"
          type="search"
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(undefined);
          }}
          placeholder="Name, code, city or state"
          maxLength={100}
          aria-invalid={!!error}
          aria-describedby={error ? "branch-search-error" : undefined}
        />
        {error && (
          <p id="branch-search-error" role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
function BranchEditor({
  record,
  disabled,
  onClose,
  onReview,
}: {
  record?: WorkBranch;
  disabled: boolean;
  onClose: () => void;
  onReview: (values: BranchValues, before?: WorkBranch) => void;
}) {
  const [initial, setInitial] = useState(record);
  const form = useForm<BranchValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: branchValues(record),
  });
  const stale = !!record && record.updatedAt !== initial?.updatedAt;
  const field = (
    name: keyof Omit<BranchValues, "isActive">,
    type = "text",
    optional = false,
  ) => (
    <div className={`field${name === "address" ? " wb-wide" : ""}`} key={name}>
      <label htmlFor={`branch-${name}`}>
        {branchLabels[name]}
        {optional ? " (optional)" : ""}
      </label>
      <input
        id={`branch-${name}`}
        type={type}
        readOnly={name === "country"}
        autoComplete={name === "email" || name === "phone" ? "off" : undefined}
        {...form.register(name)}
        aria-invalid={!!form.formState.errors[name]}
        aria-describedby={
          form.formState.errors[name] ? `branch-${name}-error` : undefined
        }
      />
      {form.formState.errors[name] && (
        <p id={`branch-${name}-error`} role="alert" className="field-error">
          {form.formState.errors[name]?.message}
        </p>
      )}
    </div>
  );
  return (
    <>
      <div className="wb-editor-heading">
        <h2>{initial?.name ?? "Add branch"}</h2>
        <button className="text-link" disabled={disabled} onClick={onClose}>
          Close
        </button>
      </div>
      {stale && (
        <div className="notice">
          <p>
            This branch changed after the form was loaded. Your draft is retained. Load
            current details before reviewing another change.
          </p>
          <button
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              setInitial(record);
              form.reset(branchValues(record));
            }}
          >
            Load current branch details
          </button>
        </div>
      )}
      <form
        data-draft-key={JSON.stringify([
          "branch-editor:v1",
          initial?.id ?? "create",
          initial?.updatedAt ?? "",
        ])}
        noValidate
        onSubmit={form.handleSubmit((value) => {
          if (!disabled && !stale) onReview(value, initial);
        })}
      >
        <fieldset disabled={disabled || stale}>
          <legend className="sr-only">Branch details</legend>
          <h3>Branch identity</h3>
          <div className="wb-fields">
            {field("code")}
            {field("name")}
          </div>
          <h3>Location</h3>
          <div className="wb-fields">
            {field("address")}
            {field("city")}
            {field("state")}
            {field("country")}
            {field("timezone")}
          </div>
          <h3>Public contact</h3>
          <div className="wb-fields">
            {field("phone", "tel", true)}
            {field("email", "email", true)}
          </div>
          <label className="wb-check">
            <input type="checkbox" {...form.register("isActive")} />
            <span>
              Active branch
              <small>Inactive branches are excluded from public branch selection.</small>
            </span>
          </label>
          <p className="notice">
            Reassign or deactivate active branch staff before deactivating this branch.
          </p>
          <div className="wb-form-actions">
            <button className="button">
              {initial ? "Review branch changes" : "Review new branch"}
            </button>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
      {initial && (
        <details className="wb-reference">
          <summary>Branch record</summary>
          <dl>
            <div>
              <dt>Reference</dt>
              <dd>{initial.id}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatBusinessDate(initial.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatBusinessDate(initial.updatedAt)}</dd>
            </div>
          </dl>
        </details>
      )}
    </>
  );
}
