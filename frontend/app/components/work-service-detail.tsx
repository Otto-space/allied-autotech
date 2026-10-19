"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Eye,
  ImageIcon,
  Pencil,
  RefreshCw,
  Tag,
  Wrench,
} from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseAdminService, type AdminService } from "@/lib/admin/service-catalogue";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { WorkServiceEditor } from "./work-service-form";
import { ServicePhoto } from "./service-photo";
import { ServiceImageEditor } from "./service-image-editor";

export function WorkServiceDetail({ serviceId }: { serviceId: string }) {
  const session = useAccountSession();
  if (!session) return null;
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role))
    return (
      <>
        <h1>Service details</h1>
        <Feedback message="Administrator access is required to manage these records." />
      </>
    );
  return (
    <ServiceRecord
      key={`${session.user.id}:${session.user.role}:${serviceId}`}
      serviceId={serviceId}
      owner={session.user.id}
    />
  );
}

function ServiceRecord({ serviceId, owner }: { serviceId: string; owner: string }) {
  const params = useSearchParams();
  const view =
    params.getAll("view").length === 1 &&
    ["edit", "image"].includes(params.get("view") ?? "")
      ? params.get("view")
      : "details";
  const resource = useResource(`/admin/services/${serviceId}`, parseAdminService);
  const mismatch = !!resource.data && resource.data.id !== serviceId;
  const record = mismatch ? undefined : resource.data;
  const error = mismatch
    ? "The returned service does not match this page. Refresh to try again."
    : resource.error;
  const blocked =
    resource.loading ||
    resource.refreshing ||
    !!error ||
    !!resource.refreshError ||
    !record;
  const [editorRefresh, setEditorRefresh] = useState(0);
  const [message, setMessage] = useState("");
  function navigate(next: "details" | "edit" | "image") {
    window.history.pushState(
      null,
      "",
      `/admin/services/${serviceId}${next === "details" ? "" : `?view=${next}`}`,
    );
    requestAnimationFrame(() => {
      const target = document.getElementById(
        next === "edit"
          ? "service-editor-title"
          : next === "image"
            ? "service-image-title"
            : "service-record-title",
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function refresh() {
    resource.refresh();
    setEditorRefresh((v) => v + 1);
  }
  return (
    <div className="work-services work-service-detail">
      <nav className="work-service-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/admin/services">Services</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{record?.name ?? "Service details"}</span>
          </li>
        </ol>
      </nav>
      <header className="work-service-heading">
        <div>
          <h1 id="service-record-title" tabIndex={-1}>
            {record?.name ?? "Service details"}
          </h1>
          <p>Review service details, pricing and workshop information.</p>
        </div>
        <div className="actions">
          <Link className="button secondary" href="/admin/services">
            <ArrowLeft size={16} aria-hidden="true" />
            Back to services
          </Link>
          <button
            className="button"
            disabled={resource.loading || resource.refreshing}
            onClick={refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Refresh service
          </button>
        </div>
      </header>
      <Feedback message={message} tone="success" toast={message} />
      {resource.loading && !record && (
        <div className="work-service-detail-loading" role="status">
          Loading service details…
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      )}
      {error && (
        <section className="work-service-detail-error">
          <h2>Service unavailable</h2>
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
          message="Service information may be out of date. Refresh before making changes."
          tone="info"
        />
      )}
      {record && (
        <>
          <dl className="work-service-summary">
            <div>
              <dt>
                <Tag size={23} aria-hidden="true" />
                Pricing
              </dt>
              <dd>
                {record.pricingType === "FIXED"
                  ? formatKobo(record.priceKobo)
                  : "Quote required"}
                {record.pricingType === "FIXED" && <small>Fixed price</small>}
              </dd>
            </div>
            <div>
              <dt>
                <Clock3 size={23} aria-hidden="true" />
                Duration
              </dt>
              <dd>
                {record.durationMinutes === null
                  ? "Not set"
                  : `${record.durationMinutes} minutes`}
              </dd>
            </div>
            <div>
              <dt>
                <Eye size={23} aria-hidden="true" />
                Visibility
              </dt>
              <dd>{record.isActive ? "Active" : "Inactive"}</dd>
            </div>
          </dl>
          {view === "image" ? (
            <div className="work-service-detail-media">
              <ServiceImageEditor
                key={record.id}
                serviceId={record.id}
                name={record.name}
                blocked={blocked}
                onUpdated={resource.refresh}
                onClose={() => navigate("details")}
              />
            </div>
          ) : (
            <div className="work-service-detail-grid">
              {view === "edit" ? (
                <WorkServiceEditor
                  id={record.id}
                  owner={owner}
                  blocked={blocked}
                  refreshKey={editorRefresh}
                  onClose={() => navigate("details")}
                  onSaved={() => {
                    setMessage("Service saved.");
                    navigate("details");
                    resource.refresh();
                  }}
                />
              ) : (
                <section
                  className="work-service-details"
                  aria-labelledby="service-details-title"
                >
                  <div className="work-service-details-heading">
                    <h2 id="service-details-title">Service details</h2>
                    <button
                      className="button"
                      disabled={blocked}
                      onClick={() => navigate("edit")}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit service
                    </button>
                  </div>
                  <ServiceFacts record={record} />
                </section>
              )}
              <section
                className="work-service-detail-photo"
                aria-labelledby="service-photo-title"
              >
                <h2 id="service-photo-title">Service image</h2>
                <div className="work-service-photo-frame">
                  {record.image ? (
                    <ServicePhoto
                      key={`${record.image.id}:${record.version}`}
                      url={record.image.url}
                      alt={record.image.altText || record.name}
                      width={720}
                      height={540}
                    />
                  ) : (
                    <div className="work-service-photo-empty">
                      <Wrench size={32} aria-hidden="true" />
                      <p>No service image yet.</p>
                    </div>
                  )}
                </div>
                {record.image && <p>{record.image.altText || record.name}</p>}
                <button
                  className="button secondary"
                  disabled={blocked}
                  onClick={() => navigate("image")}
                >
                  <ImageIcon size={17} aria-hidden="true" />
                  Manage image
                </button>
                <p className="work-service-photo-hint">
                  One image is used for the service card and detail page.
                </p>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ServiceFacts({ record }: { record: AdminService }) {
  return (
    <>
      <dl className="work-service-facts">
        <div>
          <dt>Category</dt>
          <dd>{record.category?.name ?? "No category"}</dd>
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
        <h3>Short description</h3>
        <p>{record.shortDescription || "Not provided"}</p>
      </section>
      <section className="work-service-description">
        <h3>Full description</h3>
        <p>{record.description || "Not provided"}</p>
      </section>
    </>
  );
}
