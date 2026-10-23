"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ChevronRight, Images, Pencil, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseAdminProduct, type AdminProduct } from "@/lib/admin/product-catalogue";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
import { WorkProductEditor } from "./work-product-form";
import { WorkProductMedia } from "./work-product-media";

export function WorkProductDetail({ productId }: { productId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Product details</h1>
        <Feedback message="Administrator access is required to manage products." />
      </>
    );
  return (
    <ProductRecord
      key={`${session.user.id}:${session.user.role}:${productId}`}
      productId={productId}
      owner={session.user.id}
    />
  );
}

function ProductRecord({ productId, owner }: { productId: string; owner: string }) {
  const params = useSearchParams();
  const view = params.get("view");
  const invalidView =
    params.getAll("view").length > 1 ||
    (view !== null && view !== "edit" && view !== "media");
  const resource = useResource(`/admin/catalog/products/${productId}`, parseAdminProduct);
  const mismatch = !!resource.data && resource.data.id !== productId;
  const record = mismatch ? undefined : resource.data;
  const error = mismatch
    ? "The returned product does not match this page. Refresh to try again."
    : resource.error;
  const blocked =
    resource.loading ||
    resource.refreshing ||
    !!error ||
    !!resource.refreshError ||
    !record;
  const [editorRefresh, setEditorRefresh] = useState(0);
  const [message, setMessage] = useState("");
  function navigate(next: "edit" | "media" | null) {
    window.history.pushState(
      null,
      "",
      `/admin/products/${productId}${next ? `?view=${next}` : ""}`,
    );
    requestAnimationFrame(() => {
      const target = document.getElementById(
        next === "edit"
          ? "product-editor-title"
          : next === "media"
            ? "product-detail-media-title"
            : "product-record-title",
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function refresh() {
    resource.refresh();
    setEditorRefresh((value) => value + 1);
  }
  return (
    <div className="work-services work-products work-service-detail work-product-detail">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/products">Products</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{record?.name ?? "Product details"}</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="product-record-title" tabIndex={-1}>
            {record?.name ?? "Product details"}
          </h1>
          <p>Review pricing, visibility and product information.</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/products">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to products
          </Link>
          <button
            className="button secondary"
            disabled={resource.loading || resource.refreshing}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh product
          </button>
        </div>
      </header>
      <Feedback message={message} tone="success" toast={message} />
      {resource.loading && !record && (
        <div className="work-service-detail-loading" role="status">
          Loading product details…
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}
      {error && (
        <section className="work-service-detail-error">
          <h2>Product unavailable</h2>
          <Feedback message={error} />
          <button
            className="button secondary"
            onClick={refresh}
            disabled={resource.loading || resource.refreshing}
          >
            Retry
          </button>
        </section>
      )}
      {(resource.refreshError || (error && record)) && (
        <Feedback
          message="Product information may be out of date. Refresh before making changes."
          tone="info"
        />
      )}
      {invalidView && (
        <section className="work-service-detail-error">
          <h2>Product view unavailable</h2>
          <p>This link contains an unsupported product view.</p>
          <button className="button secondary" onClick={() => navigate(null)}>
            Return to product details
          </button>
        </section>
      )}
      {record && (
        <>
          <dl className="product-detail-summary">
            <div>
              <dt>Selling price</dt>
              <dd>
                {formatKobo(record.priceKobo)}
                {record.compareAtPriceKobo !== null && (
                  <small>Comparison: {formatKobo(record.compareAtPriceKobo)}</small>
                )}
              </dd>
            </div>
            <div>
              <dt>Visibility</dt>
              <dd>{record.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>
                {record.category.name}
                {!record.category.isActive && <small>Category inactive</small>}
              </dd>
            </div>
            <div>
              <dt>Featured</dt>
              <dd>{record.featured ? "Yes" : "No"}</dd>
            </div>
          </dl>
          {!invalidView && view === "edit" ? (
            <WorkProductEditor
              id={record.id}
              owner={owner}
              blocked={blocked}
              refreshKey={editorRefresh}
              onClose={() => navigate(null)}
              onSaved={() => {
                setMessage("Product saved.");
                navigate(null);
                resource.refresh();
              }}
            />
          ) : !invalidView && view === "media" ? (
            <section
              aria-label="Compatibility and image management"
              id="product-detail-media-title"
              tabIndex={-1}
            >
              <fieldset disabled={blocked} className="product-detail-media-lock">
                <legend className="sr-only">Manage compatibility and images</legend>
                <WorkProductMedia
                  id={record.id}
                  owner={owner}
                  onClose={() => navigate(null)}
                  onUpdated={resource.refresh}
                />
              </fieldset>
            </section>
          ) : (
            <div className="product-detail-grid">
              <section
                className="work-service-details"
                aria-labelledby="product-info-title"
              >
                <div className="work-service-details-heading">
                  <h2 id="product-info-title">Product information</h2>
                  <button
                    className="button"
                    disabled={blocked || invalidView}
                    onClick={() => navigate("edit")}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Edit product
                  </button>
                </div>
                <dl className="product-detail-facts">
                  <div>
                    <dt>SKU</dt>
                    <dd>{record.sku}</dd>
                  </div>
                  <div>
                    <dt>Brand</dt>
                    <dd>{record.brand || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Manufacturer part number</dt>
                    <dd>{record.manufacturerPartNumber || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>URL name</dt>
                    <dd>{record.slug}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>
                      <time dateTime={record.createdAt}>
                        {formatBusinessDate(record.createdAt)}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>
                      <time dateTime={record.updatedAt}>
                        {formatBusinessDate(record.updatedAt)}
                      </time>
                    </dd>
                  </div>
                </dl>
                <section className="work-service-description">
                  <h3>Description</h3>
                  <p>{record.description || "Not provided"}</p>
                </section>
              </section>
              <section
                className="product-detail-images"
                aria-labelledby="product-images-title"
              >
                <div className="work-service-details-heading">
                  <h2 id="product-images-title">Images</h2>
                  <button
                    className="button secondary"
                    disabled={blocked || invalidView}
                    onClick={() => navigate("media")}
                  >
                    <Images size={16} aria-hidden="true" />
                    Compatibility &amp; images
                  </button>
                </div>
                <ProductGallery record={record} />
              </section>
            </div>
          )}
          <ProductAvailability record={record} />
          {(invalidView || view !== "media") && <ProductCompatibility record={record} />}
        </>
      )}
    </div>
  );
}

function ProductGallery({ record }: { record: AdminProduct }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const images = [...record.images].sort(
    (a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder,
  );
  const selected = images.find((image) => image.id === selectedId) ?? images[0];
  return (
    <>
      <div className="product-detail-image">
        <PublicMedia
          key={selected?.url ?? "empty"}
          src={selected?.url}
          alt={selected?.altText || record.name}
          adminPreview={selected?.source === "UPLOADED"}
          sizes="(max-width: 1100px) 90vw, 35vw"
        />
      </div>
      {images.length > 1 && (
        <div
          className="product-detail-image-picker"
          role="group"
          aria-label="Choose product image"
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              className="button secondary"
              aria-pressed={image.id === selected?.id}
              aria-label={`Show image ${index + 1}${image.isPrimary ? " (primary)" : ""}`}
              onClick={() => setSelectedId(image.id)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
      <p className="product-detail-image-caption">
        {selected
          ? selected.altText || record.name
          : "No product images have been added."}
      </p>
    </>
  );
}

function ProductAvailability({ record }: { record: AdminProduct }) {
  return (
    <section
      className="product-detail-section"
      aria-labelledby="product-availability-title"
    >
      <div className="product-detail-section-heading">
        <div>
          <h2 id="product-availability-title">Branch availability</h2>
          <p>Available stock is checked at each active branch.</p>
        </div>
        <Link className="button secondary" href="/admin/inventory">
          Product inventory
        </Link>
      </div>
      {record.availability.length ? (
        <table className="product-detail-table">
          <caption className="sr-only">Available stock by branch</caption>
          <thead>
            <tr>
              <th scope="col">Branch</th>
              <th scope="col">Availability</th>
            </tr>
          </thead>
          <tbody>
            {record.availability.map((item) => (
              <tr key={item.branch.id}>
                <th scope="row">
                  {item.branch.name} ({item.branch.code})
                </th>
                <td data-label="Availability">
                  <span
                    className={`work-service-status${item.inStock ? "" : " inactive"}`}
                  >
                    {item.inStock ? "In stock" : "No available stock"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="product-detail-empty">No branch availability has been recorded.</p>
      )}
    </section>
  );
}

function ProductCompatibility({ record }: { record: AdminProduct }) {
  return (
    <section
      className="product-detail-section"
      aria-labelledby="product-compatibility-title"
    >
      <h2 id="product-compatibility-title">Vehicle compatibility</h2>
      <p>
        Only approved technical evidence supports public fitment checks. Legacy records
        are not verified fit.
      </p>
      <Link className="button secondary" href={`/admin/fitment?productId=${record.id}`}>
        Fitment evidence and review
      </Link>
      {record.compatibilities.length ? (
        <table className="product-detail-table">
          <caption className="sr-only">Recorded vehicle compatibility</caption>
          <thead>
            <tr>
              <th scope="col">Vehicle</th>
              <th scope="col">Model years</th>
              <th scope="col">Review state</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {record.compatibilities.map((item) => (
              <tr key={item.id}>
                <th scope="row">
                  {item.make} {item.model || "· All models"}
                </th>
                <td data-label="Model years">
                  {item.yearFrom !== null && item.yearTo !== null
                    ? item.yearFrom === item.yearTo
                      ? item.yearFrom
                      : `${item.yearFrom}–${item.yearTo}`
                    : item.yearFrom !== null
                      ? `From ${item.yearFrom}`
                      : item.yearTo !== null
                        ? `Up to ${item.yearTo}`
                        : "Years not specified"}
                </td>
                <td data-label="Review state">
                  {item.reviewStatus?.toLowerCase() || "Unreviewed"}
                  {item.effect === "EXCLUDE" ? " (exclusion)" : ""}
                </td>
                <td data-label="Notes">{item.notes || "Not provided"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="product-detail-empty">
          No vehicle compatibility has been recorded.
        </p>
      )}
    </section>
  );
}
