"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Pencil, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseAdminProductCategory } from "@/lib/admin/product-categories";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkProductCategoryEditor } from "./work-product-category-form";

export function WorkProductCategoryDetail({ categoryId }: { categoryId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Category details</h1>
        <Feedback message="Administrator access is required to manage product categories." />
      </>
    );
  return (
    <CategoryRecord
      key={`${session.user.id}:${session.user.role}:${categoryId}`}
      categoryId={categoryId}
      owner={session.user.id}
    />
  );
}
function CategoryRecord({ categoryId, owner }: { categoryId: string; owner: string }) {
  const params = useSearchParams(),
    view = params.get("view");
  const invalidView =
    params.getAll("view").length > 1 || (view !== null && view !== "edit");
  const resource = useResource(
    `/admin/catalog/categories/${categoryId}`,
    parseAdminProductCategory,
  );
  const mismatch = !!resource.data && resource.data.id !== categoryId;
  const record = mismatch ? undefined : resource.data;
  const error = mismatch
    ? "The returned category does not match this page. Refresh to try again."
    : resource.error;
  const blocked =
    resource.loading ||
    resource.refreshing ||
    !!error ||
    !!resource.refreshError ||
    !record;
  const [editorRefresh, setEditorRefresh] = useState(0),
    [message, setMessage] = useState("");
  function navigate(edit: boolean) {
    window.history.pushState(
      null,
      "",
      `/admin/categories/${categoryId}${edit ? "?view=edit" : ""}`,
    );
    requestAnimationFrame(() => {
      const target = document.getElementById(
        edit ? "product-category-editor-title" : "product-category-record-title",
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
    <div className="work-services work-products work-product-categories work-service-detail work-product-category-detail">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/categories">Product categories</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{record?.name ?? "Category details"}</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="product-category-record-title" tabIndex={-1}>
            {record?.name ?? "Category details"}
          </h1>
          <p>Review category details and product grouping.</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/categories">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to categories
          </Link>
          <button
            className="button secondary"
            disabled={resource.loading || resource.refreshing}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh category
          </button>
        </div>
      </header>
      <Feedback message={message} tone="success" toast={message} />
      {resource.loading && !record && (
        <div className="work-service-detail-loading" role="status">
          Loading category details…
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}
      {error && (
        <section className="work-service-detail-error">
          <h2>Category unavailable</h2>
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
          message="Category information may be out of date. Refresh before making changes."
          tone="info"
        />
      )}
      {invalidView && (
        <section className="work-service-detail-error">
          <h2>Category view unavailable</h2>
          <p>This link contains an unsupported category view.</p>
          <button className="button secondary" onClick={() => navigate(false)}>
            Return to category details
          </button>
        </section>
      )}
      {record && (
        <>
          <dl className="product-category-detail-summary">
            <div>
              <dt>Visibility</dt>
              <dd>{record.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div>
              <dt>URL name</dt>
              <dd>{record.slug}</dd>
            </div>
          </dl>
          {!invalidView &&
            (view === "edit" ? (
              <WorkProductCategoryEditor
                id={record.id}
                owner={owner}
                blocked={blocked}
                refreshKey={editorRefresh}
                onClose={() => navigate(false)}
                onSaved={() => {
                  setMessage("Category saved.");
                  navigate(false);
                  resource.refresh();
                }}
              />
            ) : (
              <div className="product-category-detail-grid">
                <section
                  className="work-service-details"
                  aria-labelledby="product-category-details-title"
                >
                  <div className="work-service-details-heading">
                    <h2 id="product-category-details-title">Category details</h2>
                    <button
                      className="button secondary"
                      disabled={blocked}
                      onClick={() => navigate(true)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit category
                    </button>
                  </div>
                  <dl className="work-service-facts">
                    <div>
                      <dt>Name</dt>
                      <dd>{record.name}</dd>
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
                  className="product-category-detail-guidance"
                  aria-labelledby="product-category-grouping-title"
                >
                  <h2 id="product-category-grouping-title">Product grouping</h2>
                  <p>Categories organise related parts in the product catalogue.</p>
                  <p>
                    Active products must be deactivated before their category can be
                    deactivated.
                  </p>
                  <p>Changing a category does not delete its products.</p>
                  <Link
                    className="button secondary"
                    href={`/admin/products?categoryId=${categoryId}`}
                    prefetch={false}
                  >
                    View products in this category
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </section>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
