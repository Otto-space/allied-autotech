"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Info, Plus, RefreshCw } from "lucide-react";
import {
  productCategoryQuery,
  parseAdminProductCategories,
} from "@/lib/admin/product-categories";
import { useResource } from "@/lib/api/use-resource";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkProductCategoryEditor } from "./work-product-category-form";

export function WorkProductCategories() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Product categories</h1>
        <Feedback message="Administrator access is required to manage product categories." />
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
  const { params, api, invalid, edit, creating, path } = productCategoryQuery(
    new URLSearchParams(search.toString()),
  );
  const workspace = !!edit || creating;
  const resource = useResource(workspace ? null : path, parseAdminProductCategories);
  const [refreshKey, setRefreshKey] = useState(0),
    [message, setMessage] = useState("");
  const mismatch = resource.data?.items.some(
    (row) =>
      (api.has("isActive") && String(row.isActive) !== api.get("isActive")) ||
      (api.has("search") &&
        !row.name.toLowerCase().startsWith(api.get("search")!.toLowerCase())),
  );
  const error = mismatch
    ? "The returned categories do not match your filters. Refresh to try again."
    : resource.error;
  const data = mismatch || invalid ? undefined : resource.data;
  const blocked =
    invalid ||
    resource.loading ||
    resource.refreshing ||
    !!error ||
    !!resource.refreshError ||
    !data;
  const listParams = new URLSearchParams(params);
  listParams.delete("edit");
  listParams.delete("view");
  const filters = new URLSearchParams(listParams);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function navigate(next: URLSearchParams, focus = false) {
    window.history.pushState(null, "", `/admin/categories${next.size ? `?${next}` : ""}`);
    if (focus)
      requestAnimationFrame(() => {
        const target = document.getElementById(
          next.has("view") || next.has("edit")
            ? "product-category-editor-title"
            : "product-categories-title",
        );
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start", behavior: "instant" });
      });
  }
  function refresh() {
    resource.refresh();
    setRefreshKey((v) => v + 1);
  }
  function open(id?: string) {
    const next = new URLSearchParams(listParams);
    if (id) next.set("edit", id);
    else next.set("view", "create");
    setMessage("");
    navigate(next, true);
  }
  const title = edit
    ? "Edit category"
    : creating
      ? "Create category"
      : "Product categories";
  return (
    <div className="work-services work-products work-product-categories">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            {workspace ? (
              <Link href={`/admin/categories${listParams.size ? `?${listParams}` : ""}`}>
                Product categories
              </Link>
            ) : (
              <span aria-current="page">Product categories</span>
            )}
          </li>
          {workspace && (
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">{title}</span>
            </li>
          )}
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="product-categories-title" tabIndex={-1}>
            {title}
          </h1>
          <p>Organise parts with clear names and descriptions.</p>
        </div>
        <div className="actions">
          {workspace && (
            <button
              className="button secondary"
              onClick={() => navigate(listParams, true)}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to categories
            </button>
          )}
          {!creating && (
            <button
              className="button secondary"
              disabled={resource.loading || resource.refreshing}
              onClick={refresh}
            >
              <RefreshCw size={16} aria-hidden="true" />
              {edit ? "Refresh category" : "Refresh categories"}
            </button>
          )}
          {!workspace && (
            <button className="button" disabled={invalid} onClick={() => open()}>
              <Plus size={16} aria-hidden="true" />
              Add category
            </button>
          )}
        </div>
      </header>
      <Feedback message={message} tone="success" toast={message} />
      {invalid ? (
        <section className="work-service-state">
          <h2>Category filters unavailable</h2>
          <p>
            This link contains invalid category filters or an unsupported editor view.
          </p>
          <button
            className="button secondary"
            onClick={() => navigate(new URLSearchParams())}
          >
            Clear filters
          </button>
        </section>
      ) : workspace ? (
        <WorkProductCategoryEditor
          key={edit ?? "create"}
          id={edit}
          owner={owner}
          refreshKey={refreshKey}
          onClose={() => navigate(listParams, true)}
          onSaved={() => {
            setMessage("Category saved.");
            navigate(listParams, true);
            resource.refresh();
          }}
        />
      ) : (
        <>
          <CategoryFilters
            key={filters.toString()}
            params={filters}
            busy={resource.loading || resource.refreshing}
            change={navigate}
          />
          <section
            className="work-service-catalogue product-category-catalogue"
            aria-labelledby="product-category-list-title"
          >
            <div className="work-service-band">
              <h2 id="product-category-list-title">Category catalogue</h2>
              {data && (
                <span>
                  {data.items.length}{" "}
                  {data.items.length === 1 ? "category" : "categories"} on this page
                </span>
              )}
            </div>
            {resource.loading && !data && (
              <div className="work-service-state" role="status">
                Loading categories…
                <div className="product-category-skeleton" aria-hidden="true" />
              </div>
            )}
            {error && (
              <div className="work-service-state">
                <h3>Categories unavailable</h3>
                <Feedback message={error} />
                <button
                  className="button secondary"
                  onClick={refresh}
                  disabled={resource.loading || resource.refreshing}
                >
                  Retry
                </button>
              </div>
            )}
            {(resource.refreshError || (error && data)) && (
              <Feedback
                message="Category information may be out of date. Refresh before editing or changing pages."
                tone="info"
              />
            )}
            {data && data.items.length > 0 && (
              <table className="product-category-table">
                <caption className="sr-only">Product categories</caption>
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Description</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">
                        <Link
                          className="product-category-name-link"
                          href={`/admin/categories/${row.id}`}
                          prefetch={false}
                        >
                          {row.name}
                        </Link>
                        <small>
                          <span className="product-category-mobile-label">URL name </span>
                          {row.slug}
                        </small>
                      </th>
                      <td data-label="Description">
                        {row.description || "Not provided"}
                      </td>
                      <td data-label="Visibility">
                        <span
                          className={`work-service-status${row.isActive ? "" : " inactive"}`}
                        >
                          {row.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="product-category-row-actions">
                          <button
                            className="button secondary"
                            disabled={blocked}
                            onClick={() => open(row.id)}
                          >
                            View &amp; edit<span className="sr-only"> {row.name}</span>
                          </button>
                          <Link
                            className="text-link"
                            href={`/admin/products?categoryId=${row.id}`}
                            prefetch={false}
                          >
                            View products<span className="sr-only"> in {row.name}</span>
                            <ArrowRight size={14} aria-hidden="true" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {data?.items.length === 0 && (
              <div className="work-service-state">
                <h3>No categories found.</h3>
                <p>Adjust your filters or add a category.</p>
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
            <nav
              className="work-service-pagination"
              aria-label="Product categories pages"
            >
              <button
                className="button secondary"
                disabled={blocked || !cursor}
                onClick={() => {
                  const next = new URLSearchParams(filters),
                    previous = trail.at(-1);
                  if (previous && previous !== "start") next.set("cursor", previous);
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
                    : "More results"
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
          <p className="product-category-note">
            <Info size={17} aria-hidden="true" />
            Active products must be deactivated before their category can be deactivated.
          </p>
        </>
      )}
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
    [active, setActive] = useState(params.get("isActive") ?? ""),
    [error, setError] = useState("");
  return (
    <form
      className="product-category-filters"
      aria-label="Filter product categories"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams();
        if (search.trim()) next.set("search", search.trim());
        if (active) next.set("isActive", active);
        if (productCategoryQuery(next).invalid) {
          setError(
            "Enter a category name prefix of up to 120 characters without control characters.",
          );
          document.getElementById("product-category-search")?.focus();
          return;
        }
        setError("");
        change(next);
      }}
    >
      <div className="field">
        <label htmlFor="product-category-search">Search category names</label>
        <input
          id="product-category-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Starts with a category name"
          maxLength={120}
          aria-invalid={!!error}
          aria-describedby={error ? "product-category-search-error" : undefined}
        />
        {error && (
          <p id="product-category-search-error" className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor="product-category-visibility">Visibility</label>
        <select
          id="product-category-visibility"
          value={active}
          onChange={(event) => setActive(event.target.value)}
        >
          <option value="">All visibility</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div className="product-category-filter-actions">
        <button
          type="button"
          className="button secondary"
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
        <button className="button" type="submit" disabled={busy}>
          Apply filters
        </button>
      </div>
    </form>
  );
}
