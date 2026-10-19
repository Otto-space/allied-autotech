"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Wrench,
  TriangleAlert,
} from "lucide-react";
import { adminServiceQuery, parseAdminServices } from "@/lib/admin/service-catalogue";
import { useResource } from "@/lib/api/use-resource";
import { dashboardNavigation } from "@/lib/dashboard-navigation";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkServiceCategory } from "./work-service-category";
import { WorkServiceEditor } from "./work-service-form";
import { ServiceImageEditor } from "./service-image-editor";
import { ServicePhoto } from "./service-photo";

export function WorkServices() {
  const session = useAccountSession();
  if (!session) return null;
  if (
    !dashboardNavigation(session.user.role).some((group) =>
      group.links.some((link) => link.href === "/admin/services"),
    )
  )
    return (
      <>
        <h1>Services</h1>
        <Feedback message="Administrator access is required to manage these records." />
      </>
    );
  return (
    <ServiceWorkspace
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
    />
  );
}
function ServiceWorkspace({ owner }: { owner: string }) {
  const search = useSearchParams();
  const { params, api, invalid, path } = adminServiceQuery(
    new URLSearchParams(search.toString()),
  );
  const resource = useResource(path, parseAdminServices);
  const [editing, setEditing] = useState<string>();
  const [editorKey, setEditorKey] = useState(0);
  const [image, setImage] = useState<{ id: string; name: string }>();
  const [message, setMessage] = useState<string>();
  const mismatch = resource.data?.items.some(
    (r) =>
      (api.has("isActive") && String(r.isActive) !== api.get("isActive")) ||
      (api.has("pricingType") && r.pricingType !== api.get("pricingType")) ||
      (api.has("categoryId") && r.categoryId !== api.get("categoryId")),
  );
  const error =
    resource.error ||
    (mismatch
      ? "The returned services do not match your filters. Refresh to try again."
      : undefined);
  const data = !invalid && !error && !resource.loading ? resource.data : undefined;
  const busy = resource.loading || resource.refreshing;
  const showImage = !!image && !!resource.data && !error;
  const blocked = invalid || busy || !!error || !!resource.refreshError || !data;
  const filters = new URLSearchParams(params);
  filters.delete("cursor");
  filters.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function navigate(next: URLSearchParams) {
    window.history.pushState(null, "", `/admin/services${next.size ? `?${next}` : ""}`);
  }
  function focusEditor() {
    requestAnimationFrame(() => {
      const el = document.getElementById("service-editor-title");
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function create() {
    setEditing(undefined);
    setImage(undefined);
    setEditorKey((v) => v + 1);
    focusEditor();
  }
  return (
    <div className="work-services">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={13} aria-hidden="true" />
            <span aria-current="page">Services</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1>Services</h1>
          <p>Maintain published services, pricing and appointment durations.</p>
        </div>
        <div className="actions">
          <button className="button secondary" disabled={busy} onClick={resource.refresh}>
            <RefreshCw size={15} aria-hidden="true" />
            Refresh records
          </button>
          <button className="button" disabled={blocked} onClick={create}>
            <Plus size={16} aria-hidden="true" />
            Create service
          </button>
        </div>
      </header>
      <Feedback message={message} tone="success" toast={message} />
      <ServiceFilters
        key={filters.toString()}
        params={filters}
        busy={busy}
        change={navigate}
      />
      {resource.refreshError && (
        <Feedback
          message="Services may be out of date. Refresh before making changes."
          tone="info"
        />
      )}
      {invalid && (
        <Feedback message="Some service filters are invalid. Correct them or clear filters to continue." />
      )}
      <div className={showImage ? "work-service-image-workspace" : "work-service-layout"}>
        {!showImage && (
          <section
            className="work-service-catalogue"
            aria-labelledby="service-catalogue-title"
          >
            <header className="work-service-band">
              <h2 id="service-catalogue-title">Service catalogue</h2>
              <span role="status">
                {data
                  ? `${data.items.length} ${data.items.length === 1 ? "service" : "services"} on this page`
                  : busy
                    ? "Loading services…"
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
                <TriangleAlert size={26} aria-hidden="true" />
                <h3>Services unavailable</h3>
                <Feedback message={error} />
                <button className="button secondary" onClick={resource.refresh}>
                  Retry
                </button>
              </div>
            )}
            {data && data.items.length > 0 && (
              <table className="work-service-table">
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Pricing</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <th scope="row">
                        <div className="work-service-identity">
                          <div className="work-service-thumb">
                            {r.image ? (
                              <ServicePhoto
                                url={r.image.url}
                                alt={r.image.altText || r.name}
                                width={64}
                                height={64}
                              />
                            ) : (
                              <Wrench size={23} aria-hidden="true" />
                            )}
                          </div>
                          <div>
                            <strong>
                              <Link href={`/admin/services/${r.id}`} prefetch={false}>
                                {r.name}
                              </Link>
                            </strong>
                            <span>{r.category?.name ?? "No category"}</span>
                          </div>
                        </div>
                      </th>
                      <td data-label="Pricing">
                        <span>
                          {r.pricingType === "FIXED"
                            ? formatKobo(r.priceKobo)
                            : "Quote required"}
                        </span>
                        {r.pricingType === "FIXED" && <small>Fixed price</small>}
                      </td>
                      <td data-label="Duration">
                        {r.durationMinutes === null
                          ? "Not set"
                          : `${r.durationMinutes} min`}
                      </td>
                      <td data-label="Visibility">
                        <span
                          className={`work-service-status${r.isActive ? "" : " inactive"}`}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="work-service-row-actions">
                        <button
                          className="button secondary"
                          disabled={blocked}
                          onClick={() => {
                            setEditing(r.id);
                            setEditorKey((v) => v + 1);
                            focusEditor();
                          }}
                        >
                          View &amp; edit
                        </button>
                        <button
                          className="button secondary"
                          disabled={blocked}
                          onClick={() => {
                            setImage({ id: r.id, name: r.name });
                            requestAnimationFrame(() =>
                              document
                                .getElementById("service-image-title")
                                ?.scrollIntoView({ block: "start" }),
                            );
                          }}
                        >
                          Manage image
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {data?.items.length === 0 && (
              <div className="work-service-state">
                <Wrench size={26} aria-hidden="true" />
                <h3>No services match these filters.</h3>
                <p>Adjust your filters or create a service.</p>
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
            <nav className="work-service-pagination" aria-label="Services pages">
              <button
                className="button secondary"
                disabled={busy || !cursor || !!error || invalid}
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
                disabled={busy || !!error || invalid || !data?.nextCursor}
                onClick={() => {
                  if (!data?.nextCursor) return;
                  const next = new URLSearchParams(filters);
                  next.set("cursor", data.nextCursor);
                  if (trail.length < 50 && (!cursor || trail.length))
                    next.set("_trail", [...trail, cursor ?? "start"].join(","));
                  navigate(next);
                }}
              >
                Next
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </nav>
          </section>
        )}
        {!image && (resource.data || !error) && (
          <WorkServiceEditor
            key={`${editing ?? "create"}:${editorKey}`}
            id={editing}
            owner={owner}
            blocked={blocked}
            onCreate={create}
            onSaved={() => {
              setMessage("Service saved.");
              setEditing(undefined);
              setEditorKey((v) => v + 1);
              resource.refresh();
            }}
          />
        )}
        {showImage && image && (
          <ServiceImageEditor
            key={image.id}
            serviceId={image.id}
            name={image.name}
            onUpdated={resource.refresh}
            onClose={() => {
              setImage(undefined);
              resource.refresh();
              requestAnimationFrame(() =>
                document
                  .getElementById("service-catalogue-title")
                  ?.scrollIntoView({ block: "start" }),
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
function ServiceFilters({
  params,
  busy,
  change,
}: {
  params: URLSearchParams;
  busy: boolean;
  change: (params: URLSearchParams) => void;
}) {
  const [category, setCategory] = useState(params.get("categoryId") ?? "");
  const [categoriesBlocked, setCategoriesBlocked] = useState(true);
  const [error, setError] = useState<string>();
  return (
    <form
      className="work-service-filters"
      aria-label="Service filters"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget),
          next = new URLSearchParams();
        for (const key of ["search", "isActive", "pricingType"]) {
          const value = String(data.get(key) ?? "").trim();
          if (value) next.set(key, value);
        }
        if (category) next.set("categoryId", category);
        const query = adminServiceQuery(next);
        if (query.invalid) {
          setError("Use 2–100 characters for search and valid service filters.");
          return;
        }
        setError(undefined);
        change(query.params);
      }}
    >
      <div className="field work-service-search">
        <label htmlFor="work-service-search">Search services</label>
        <div>
          <Search size={16} aria-hidden="true" />
          <input
            id="work-service-search"
            name="search"
            type="search"
            minLength={2}
            maxLength={100}
            placeholder="Name or description"
            defaultValue={params.get("search") ?? ""}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="work-service-visibility">Visibility</label>
        <select
          id="work-service-visibility"
          name="isActive"
          defaultValue={params.get("isActive") ?? ""}
        >
          <option value="">All services</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="work-service-pricing">Pricing</label>
        <select
          id="work-service-pricing"
          name="pricingType"
          defaultValue={params.get("pricingType") ?? ""}
        >
          <option value="">All pricing</option>
          <option value="FIXED">Fixed price</option>
          <option value="QUOTE_REQUIRED">Quote required</option>
        </select>
      </div>
      <div className="field work-service-category-filter">
        <label htmlFor="work-service-category">Category</label>
        <WorkServiceCategory
          id="work-service-category"
          value={category}
          onChange={setCategory}
          onAvailabilityChange={setCategoriesBlocked}
        />
      </div>
      <div className="actions">
        <button className="button" disabled={busy || categoriesBlocked}>
          Apply filters
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setCategory("");
            setError(undefined);
            const form = document.getElementById("work-service-search")?.closest("form");
            form?.reset();
            change(new URLSearchParams());
          }}
        >
          Clear filters
        </button>
      </div>
      <Feedback message={error} />
    </form>
  );
}
