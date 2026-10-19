"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ChevronRight, Pencil, RefreshCw } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseAdminCategory } from "@/lib/admin/category-catalogue";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkCategoryEditor } from "./work-category-form";

export function WorkCategoryDetail({ categoryId }: { categoryId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Category details</h1>
        <Feedback message="Administrator access is required to manage service categories." />
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
  const params = useSearchParams();
  const editing = params.getAll("view").length === 1 && params.get("view") === "edit";
  const resource = useResource(
    `/admin/service-categories/${categoryId}`,
    parseAdminCategory,
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
  const [editorRefresh, setEditorRefresh] = useState(0);
  const [message, setMessage] = useState("");
  function navigate(edit: boolean) {
    window.history.pushState(
      null,
      "",
      `/admin/service-categories/${categoryId}${edit ? "?view=edit" : ""}`,
    );
    requestAnimationFrame(() => {
      const target = document.getElementById(
        edit ? "category-editor-title" : "category-record-title",
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
    <div className="work-services work-categories work-service-detail work-category-detail">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/service-categories">Service categories</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{record?.name ?? "Category details"}</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="category-record-title" tabIndex={-1}>
            {record?.name ?? "Category details"}
          </h1>
          <p>Review category details and service grouping.</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/service-categories">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to categories
          </Link>
          <button
            className="button"
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
      {record && (
        <>
          <dl className="category-detail-summary">
            <div>
              <dt>Visibility</dt>
              <dd>{record.isActive ? "Active" : "Inactive"}</dd>
            </div>
            <div>
              <dt>URL name</dt>
              <dd>{record.slug}</dd>
            </div>
          </dl>
          <div className="category-detail-grid">
            {editing ? (
              <WorkCategoryEditor
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
              <section
                className="work-service-details"
                aria-labelledby="category-details-title"
              >
                <div className="work-service-details-heading">
                  <h2 id="category-details-title">Category details</h2>
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
            )}
            <section
              className="category-detail-guidance"
              aria-labelledby="category-grouping-title"
            >
              <h2 id="category-grouping-title">Service grouping</h2>
              <p>Categories help customers browse related services.</p>
              <p>
                An active category appears in public browsing when it has an active
                service.
              </p>
              <p>
                Deactivating a category removes the grouping while its active services
                remain available.
              </p>
              <Link
                className="button secondary"
                href={`/admin/services?categoryId=${categoryId}`}
                prefetch={false}
              >
                View services in this category
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
