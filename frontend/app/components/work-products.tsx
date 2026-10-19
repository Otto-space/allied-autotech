"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseAdminProducts, productQuery } from "@/lib/admin/product-catalogue";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
import { WorkProductFilters } from "./work-product-filters";
import { WorkProductEditor } from "./work-product-form";
import { WorkProductMedia } from "./work-product-media";

export function WorkProducts() {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Products</h1>
        <Feedback message="Administrator access is required to manage these records." />
      </>
    );
  return (
    <ProductWorkspace
      key={`${session.user.id}:${session.user.role}`}
      owner={session.user.id}
    />
  );
}
function ProductWorkspace({ owner }: { owner: string }) {
  const search = useSearchParams(),
    query = productQuery(new URLSearchParams(search.toString()));
  const { params, api, invalid, edit, media, creating } = query,
    workspace = !!edit || !!media || creating;
  const resource = useResource(workspace ? null : query.path, parseAdminProducts);
  const [message, setMessage] = useState(""),
    [editorRefresh, setEditorRefresh] = useState(0);
  const mismatch = resource.data?.items.some(
    (r) =>
      (api.has("isActive") && String(r.isActive) !== api.get("isActive")) ||
      (api.has("featured") && String(r.featured) !== api.get("featured")) ||
      (api.has("categoryId") && r.category.id !== api.get("categoryId")),
  );
  const error =
    resource.error ||
    (mismatch
      ? "The returned products do not match your filters. Refresh to try again."
      : undefined);
  const data = !invalid && !error && !resource.loading ? resource.data : undefined;
  const busy = resource.loading || resource.refreshing,
    blocked = invalid || busy || !!error || !!resource.refreshError || !data;
  const listParams = new URLSearchParams(params);
  for (const key of ["edit", "media", "view"]) listParams.delete(key);
  const filterParams = new URLSearchParams(listParams);
  filterParams.delete("cursor");
  filterParams.delete("_trail");
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  function navigate(next: URLSearchParams, focus?: string) {
    window.history.pushState(null, "", `/admin/products${next.size ? `?${next}` : ""}`);
    if (focus)
      requestAnimationFrame(() => {
        const target = document.getElementById(focus);
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "start", behavior: "instant" });
      });
  }
  function open(kind: "edit" | "media" | "create", id?: string) {
    const next = new URLSearchParams(listParams);
    if (kind === "create") next.set("view", "create");
    else next.set(kind, id!);
    navigate(next, "products-title");
  }
  const close = () => navigate(listParams, "products-title");
  const refresh = () => {
    resource.refresh();
    setEditorRefresh((v) => v + 1);
  };
  return (
    <div className="work-services work-products">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            {workspace ? (
              <button type="button" className="text-link" onClick={close}>
                Products
              </button>
            ) : (
              <span aria-current="page">Products</span>
            )}
          </li>
          {workspace && (
            <li>
              <ChevronRight size={14} aria-hidden="true" />
              <span aria-current="page">
                {media
                  ? "Compatibility & images"
                  : edit
                    ? "Edit product"
                    : "Create product"}
              </span>
            </li>
          )}
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="products-title" tabIndex={-1}>
            {media
              ? "Product records"
              : edit
                ? "Edit product"
                : creating
                  ? "Create product"
                  : "Products"}
          </h1>
          <p>
            {workspace
              ? "Review product details before saving changes."
              : "Manage product details, pricing and catalogue visibility."}
          </p>
        </div>
        <div className="actions">
          {workspace ? (
            <button type="button" className="button secondary" onClick={close}>
              <ArrowLeft size={16} aria-hidden="true" />
              Back to products
            </button>
          ) : null}
          {!media && !creating && (
            <button className="button secondary" disabled={busy} onClick={refresh}>
              <RefreshCw size={16} aria-hidden="true" />
              {edit ? "Refresh product" : "Refresh products"}
            </button>
          )}
          {!workspace && (
            <button className="button" disabled={blocked} onClick={() => open("create")}>
              <Plus size={16} aria-hidden="true" />
              Add product
            </button>
          )}
        </div>
      </header>
      <Feedback message={message} tone="success" toast={message} />
      {media ? (
        <WorkProductMedia
          key={media}
          id={media}
          owner={owner}
          onClose={close}
          onUpdated={resource.refresh}
        />
      ) : workspace ? (
        <div className="product-editor-grid">
          <WorkProductEditor
            key={edit ?? "create"}
            id={edit}
            owner={owner}
            blocked={false}
            refreshKey={editorRefresh}
            onClose={close}
            onSaved={() => {
              setMessage("Product saved.");
              close();
              resource.refresh();
            }}
          />
          <aside className="product-guidance">
            <h2>Catalogue guidance</h2>
            <p>An active product requires an active category.</p>
            <p>Stock is managed in Product inventory.</p>
            <p>Photos and vehicle compatibility are managed separately.</p>
            <Link className="text-link" href="/admin/inventory">
              Product inventory
              <ChevronRight size={14} aria-hidden="true" />
            </Link>
            {edit && (
              <button className="button secondary" onClick={() => open("media", edit)}>
                Compatibility &amp; images
              </button>
            )}
          </aside>
        </div>
      ) : (
        <>
          <WorkProductFilters
            key={filterParams.toString()}
            params={filterParams}
            busy={busy}
            change={(next) => navigate(next)}
          />
          {invalid && (
            <Feedback message="Some product filters are invalid. Correct them or clear filters to continue." />
          )}
          {resource.refreshError && (
            <Feedback
              message="Product information may be out of date. Refresh before making changes."
              tone="info"
            />
          )}
          <section
            className="work-service-catalogue"
            aria-labelledby="product-catalogue-title"
          >
            <div className="work-service-band">
              <h2 id="product-catalogue-title">Product catalogue</h2>
              {data && (
                <span>
                  {data.items.length} {data.items.length === 1 ? "product" : "products"}{" "}
                  on this page
                </span>
              )}
            </div>
            {resource.loading && (
              <div className="product-loading" role="status">
                Loading products…
                <div aria-hidden="true" />
                <div aria-hidden="true" />
                <div aria-hidden="true" />
              </div>
            )}
            {error && (
              <div className="product-error">
                <h3>Products unavailable</h3>
                <Feedback message={error} />
                <button className="button secondary" onClick={refresh} disabled={busy}>
                  Retry products
                </button>
              </div>
            )}
            {data?.items.length === 0 && (
              <div className="empty">
                <h3>No products found</h3>
                <p>Try another search or clear your filters.</p>
                <button
                  className="button secondary"
                  onClick={() => navigate(new URLSearchParams())}
                >
                  Clear filters
                </button>
              </div>
            )}
            {!!data?.items.length && (
              <table className="product-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col">Price</th>
                    <th scope="col">Visibility</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => {
                    const image = row.images.find((r) => r.isPrimary) ?? row.images[0];
                    return (
                      <tr key={row.id}>
                        <th scope="row">
                          <div className="product-identity">
                            <div className="product-thumb">
                              <PublicMedia
                                src={image?.url}
                                alt={image?.altText ?? row.name}
                                adminPreview={image?.source === "UPLOADED"}
                                sizes="64px"
                              />
                            </div>
                            <div>
                              <strong>
                                <Link href={`/admin/products/${row.id}`} prefetch={false}>
                                  {row.name}
                                </Link>
                              </strong>
                              <small>{row.sku}</small>
                              {row.brand && <small>{row.brand}</small>}
                              {row.featured && (
                                <span className="product-featured">Featured</span>
                              )}
                            </div>
                          </div>
                        </th>
                        <td data-label="Category">{row.category.name}</td>
                        <td data-label="Price">
                          <strong>{formatKobo(row.priceKobo)}</strong>
                          {row.compareAtPriceKobo !== null && (
                            <small>
                              Comparison: {formatKobo(row.compareAtPriceKobo)}
                            </small>
                          )}
                          <small>
                            {row.availability.some((r) => r.inStock)
                              ? "In stock at a branch"
                              : "No available stock"}
                          </small>
                        </td>
                        <td data-label="Visibility">
                          <span
                            className={`work-service-status${row.isActive ? "" : " inactive"}`}
                          >
                            {row.isActive ? "Active" : "Inactive"}
                          </span>
                          {!row.category.isActive && <small>Category inactive</small>}
                        </td>
                        <td>
                          <div className="product-row-actions">
                            <button
                              className="button secondary"
                              disabled={blocked}
                              onClick={() => open("edit", row.id)}
                            >
                              View &amp; edit
                            </button>
                            <button
                              className="button secondary"
                              disabled={blocked}
                              onClick={() => open("media", row.id)}
                            >
                              Compatibility &amp; images
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <nav className="pagination" aria-label="Product pages">
              <button
                className="button secondary"
                disabled={!cursor || blocked}
                onClick={() => {
                  const next = new URLSearchParams(filterParams),
                    previous = trail.at(-1);
                  if (previous && previous !== "start") next.set("cursor", previous);
                  if (trail.length > 1) next.set("_trail", trail.slice(0, -1).join(","));
                  navigate(next);
                }}
              >
                Previous
              </button>
              <span>
                {cursor && trail.length === 0
                  ? "More results"
                  : `Page ${trail.length + 1}`}
              </span>
              <button
                className="button secondary"
                disabled={!data?.nextCursor || blocked}
                onClick={() => {
                  const next = new URLSearchParams(filterParams);
                  next.set("cursor", data!.nextCursor!);
                  const history = [...trail, cursor ?? "start"];
                  if (history.length <= 20) next.set("_trail", history.join(","));
                  navigate(next);
                }}
              >
                Next
              </button>
            </nav>
          </section>
        </>
      )}
    </div>
  );
}
