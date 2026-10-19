"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Plus, RefreshCw } from "lucide-react";
import { categoryQuery, parseAdminCategoryPage } from "@/lib/admin/category-catalogue";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { WorkCategoryEditor } from "./work-category-form";
import { Feedback } from "./feedback";

export function WorkServiceCategories() {
  const session = useAccountSession();
  if (!session) return <p role="status">Loading account…</p>;
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
    return (
      <>
        <h1>Service categories</h1>
        <Feedback message="Administrator access is required to manage service categories." />
      </>
    );
  return (
    <CategoryWorkspace
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
    />
  );
}

function CategoryWorkspace({ owner }: { owner: string }) {
  const search = useSearchParams();
  const { params, api, invalid, edit, path } = categoryQuery(
    new URLSearchParams(search.toString()),
  );
  const resource = useResource(path, parseAdminCategoryPage);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const mismatch = resource.data?.items.some(
    (row) => api.has("isActive") && String(row.isActive) !== api.get("isActive"),
  );
  const error =
    resource.error ||
    (mismatch
      ? "The returned categories do not match your filters. Refresh to try again."
      : undefined);
  const data = !invalid && !error && !resource.loading ? resource.data : undefined;
  const busy = resource.loading || resource.refreshing;
  const blocked = invalid || busy || !!error || !!resource.refreshError || !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function navigate(next: URLSearchParams) {
    window.history.pushState(
      null,
      "",
      `/admin/service-categories${next.size ? `?${next}` : ""}`,
    );
  }
  function focusEditor() {
    requestAnimationFrame(() => {
      const el = document.getElementById("category-editor-title");
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function create() {
    const next = new URLSearchParams(params);
    next.delete("edit");
    navigate(next);
    setRevision((v) => v + 1);
    focusEditor();
  }
  return (
    <div className="work-services work-categories">
      <header className="work-service-heading">
        <div>
          <h1>Service categories</h1>
          <p>Group services for customers to browse.</p>
        </div>
        <div className="actions">
          <button className="button secondary" disabled={busy} onClick={resource.refresh}>
            <RefreshCw size={15} aria-hidden="true" />
            Refresh records
          </button>
          <button className="button" disabled={blocked} onClick={create}>
            <Plus size={16} aria-hidden="true" />
            Create category
          </button>
        </div>
      </header>
      <p className="category-guidance">
        Deactivating a category removes the grouping while its active services remain
        available.
      </p>
      <Feedback message={message} tone="success" toast={message} />
      <CategoryFilters
        key={`${params.get("search")}:${params.get("isActive")}`}
        params={params}
        busy={busy}
        change={navigate}
      />
      {resource.refreshError && (
        <Feedback
          message="Category information may be out of date. Refresh before making changes."
          tone="info"
        />
      )}
      {invalid && (
        <Feedback message="Some category filters are invalid. Correct them or clear filters to continue." />
      )}
      <div className="work-service-layout">
        <section
          className="work-service-catalogue"
          aria-labelledby="category-catalogue-title"
        >
          <header className="work-service-band">
            <h2 id="category-catalogue-title">Categories</h2>
            <span role="status">
              {data
                ? `${data.items.length} ${data.items.length === 1 ? "category" : "categories"} on this page`
                : busy
                  ? "Loading categories…"
                  : "Records unavailable"}
            </span>
          </header>
          {resource.loading && (
            <div className="work-service-skeleton" aria-hidden="true">
              <div />
              <div />
              <div />
            </div>
          )}
          {error && (
            <div className="work-service-state">
              <h3>Categories could not be loaded.</h3>
              <Feedback message={error} />
              <button className="button secondary" onClick={resource.refresh}>
                Retry categories
              </button>
            </div>
          )}
          {data && data.items.length > 0 && (
            <table className="category-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Visibility</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <strong>
                        <Link
                          href={`/admin/service-categories/${row.id}`}
                          prefetch={false}
                        >
                          {row.name}
                        </Link>
                      </strong>
                      <small>URL name: {row.slug}</small>
                      <p>{row.description || "No description provided."}</p>
                    </th>
                    <td data-label="Visibility">
                      <span
                        className={`work-service-status${row.isActive ? "" : " inactive"}`}
                      >
                        {row.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="button secondary"
                        disabled={blocked}
                        onClick={() => {
                          const next = new URLSearchParams(params);
                          next.set("edit", row.id);
                          navigate(next);
                          setRevision((v) => v + 1);
                          focusEditor();
                        }}
                      >
                        View &amp; edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data?.items.length === 0 && (
            <div className="work-service-state">
              <h3>No categories found.</h3>
              <p>Adjust your filters or create a category.</p>
              <button
                className="button secondary"
                onClick={() => navigate(new URLSearchParams())}
              >
                Clear filters
              </button>
              {cursor && (
                <button className="button secondary" onClick={() => navigate(filters)}>
                  Return to first page
                </button>
              )}
            </div>
          )}
          <nav className="work-service-pagination" aria-label="Service categories pages">
            <button
              className="button secondary"
              disabled={blocked || !cursor}
              onClick={() => {
                const next = new URLSearchParams(filters),
                  prev = trail.at(-1);
                if (prev && prev !== "start") next.set("cursor", prev);
                if (trail.length > 1) next.set("_trail", trail.slice(0, -1).join(","));
                navigate(next);
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" />
              Previous
            </button>
            <span>
              {cursor
                ? trail.length
                  ? `Page ${trail.length + 1}`
                  : "Linked page"
                : "Page 1"}
            </span>
            <button
              className="button secondary"
              disabled={blocked || !data?.nextCursor}
              onClick={() => {
                if (!data?.nextCursor) return;
                const next = new URLSearchParams(filters);
                next.set("cursor", data.nextCursor);
                if (trail.length < 20 && (!cursor || trail.length))
                  next.set("_trail", [...trail, cursor ?? "start"].join(","));
                navigate(next);
              }}
            >
              Next
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </nav>
        </section>
        {!invalid && !error && (
          <WorkCategoryEditor
            key={`${edit ?? "create"}:${revision}`}
            id={edit}
            owner={owner}
            blocked={blocked}
            onClose={create}
            onSaved={() => {
              setMessage("Category saved.");
              create();
              resource.refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function CategoryFilters({
  params,
  busy,
  change,
}: {
  params: URLSearchParams;
  busy: boolean;
  change: (next: URLSearchParams) => void;
}) {
  const [search, setSearch] = useState(params.get("search") ?? ""),
    [active, setActive] = useState(params.get("isActive") ?? "");
  const [error, setError] = useState("");
  return (
    <form
      className="category-filters"
      aria-label="Filter service categories"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        if (search.trim()) next.set("search", search.trim());
        if (active) next.set("isActive", active);
        if (categoryQuery(next).invalid) {
          setError(
            "Enter a category name prefix of up to 120 characters without control characters.",
          );
          document.getElementById("category-search")?.focus();
          return;
        }
        setError("");
        change(next);
      }}
    >
      <div className="field">
        <label htmlFor="category-search">Category name starts with</label>
        <input
          id="category-search"
          value={search}
          maxLength={120}
          onChange={(e) => setSearch(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "category-search-error" : undefined}
        />
        {error && (
          <p className="field-error" id="category-search-error">
            {error}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="category-visibility">Visibility</label>
        <select
          id="category-visibility"
          value={active}
          onChange={(e) => setActive(e.target.value)}
        >
          <option value="">All categories</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div className="actions">
        <button className="button" disabled={busy}>
          Apply filters
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={busy}
          onClick={() => {
            setSearch("");
            setActive("");
            setError("");
            change(new URLSearchParams());
          }}
        >
          Clear filters
        </button>
      </div>
    </form>
  );
}
