"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  Wrench,
  X,
} from "lucide-react";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useResource } from "@/lib/api/use-resource";
import { parseServiceDiscovery } from "@/lib/api/public-schemas";
import { ServiceDiscoveryControls } from "./service-discovery-controls";
import { formatKobo } from "@/lib/format/money";
import {
  normalizeServiceQuery,
  serviceApiPath,
  servicePricing,
} from "@/lib/service-discovery";
import { ServicePhoto } from "./service-photo";
import { Feedback } from "./feedback";

export function ServicesCatalogue({
  initial,
}: {
  initial: PublicSeed<ReturnType<typeof parseServiceDiscovery>>;
}) {
  const searchParams = useSearchParams();
  const { params, invalid } = normalizeServiceQuery(
    new URLSearchParams(searchParams.toString()),
  );
  const pricing = params.get("pricingType") ?? "";
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const filtered = !!(pricing || params.get("search") || params.get("categoryId"));
  const resource = useResource(
    serviceApiPath(params),
    parseServiceDiscovery,
    initial.data,
    {
      initialError: initial.error,
      revalidateOnMount: false,
    },
  );
  function navigate(next: URLSearchParams) {
    const query = normalizeServiceQuery(next).params.toString();
    const url = `/services${query ? `?${query}` : ""}${window.location.hash}`;
    if (
      url !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(null, "", url);
  }
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(next);
  }
  function filter(value: string, restoreFocus = false) {
    change("pricingType", value);
    if (restoreFocus) document.getElementById("service-type-all")?.focus();
  }
  function clear() {
    navigate(new URLSearchParams());
    document.getElementById("service-type-all")?.focus();
  }
  function pageTo(next: URLSearchParams) {
    navigate(next);
    document.getElementById("service-results-heading")?.focus({ preventScroll: true });
    document
      .getElementById("service-catalogue")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  const pricingLabel = servicePricing.find(([value]) => value === pricing)?.[1];
  return (
    <>
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      <div className="services-discovery-panel">
        <div className="services-results-heading">
          <h2 id="service-results-heading" className="sr-only" tabIndex={-1}>
            Find your service
          </h2>
          <p role="status" aria-live="polite">
            {resource.loading
              ? "Loading services…"
              : resource.error
                ? "Services unavailable"
                : `${resource.data?.totalMatches ?? 0} ${resource.data?.totalMatches === 1 ? "service" : "services"} found${cursor || resource.data?.nextCursor ? ` · ${resource.data?.items.length ?? 0} on this page` : ""}`}
          </p>
        </div>
        {invalid && (
          <p className="notice">
            Some filters in this link were invalid and have been ignored. Review the
            filters below.
          </p>
        )}
        <ServiceDiscoveryControls params={params} change={change} />
        <fieldset className="services-pricing">
          <legend>Service type</legend>
          <div className="services-pricing-options">
            {servicePricing.map(([value, label]) => (
              <label key={value}>
                <input
                  id={`service-type-${value || "all"}`}
                  type="radio"
                  name="service-type"
                  value={value}
                  checked={pricing === value}
                  onChange={() => filter(value)}
                />
                <span>
                  <Check size={15} aria-hidden="true" />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="services-filter-summary">
        {filtered ? (
          <>
            {params.get("search") && (
              <button
                type="button"
                className="services-chip"
                onClick={() => change("search", "")}
                aria-label="Remove service search"
              >
                {params.get("search")} <X size={14} aria-hidden="true" />
              </button>
            )}
            {params.get("categoryId") && (
              <button
                type="button"
                className="services-chip"
                onClick={() => change("categoryId", "")}
              >
                Remove category filter <X size={14} aria-hidden="true" />
              </button>
            )}
            {pricing && (
              <button
                className="services-chip"
                type="button"
                aria-label={`Remove ${pricingLabel} filter`}
                onClick={() => filter("", true)}
              >
                {pricingLabel}
                <X size={14} aria-hidden="true" />
              </button>
            )}
            <button className="services-clear" type="button" onClick={clear}>
              Clear filter
            </button>
          </>
        ) : (
          <p>Choose a service to see its details and next steps.</p>
        )}
      </div>
      <div aria-busy={resource.loading} className="services-results">
        {resource.error ? (
          <div className="services-state services-error">
            <h3>Services are unavailable</h3>
            <Feedback message={resource.error} />
            <div className="actions">
              <button
                type="button"
                className="button"
                onClick={resource.refresh}
                disabled={resource.loading}
              >
                Retry services
              </button>
              {cursor && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => change("cursor", "")}
                >
                  Restart service search
                </button>
              )}
              <Link className="text-link" href="/contact">
                Contact Allied AutoTech <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : resource.loading && !resource.data ? (
          <div aria-hidden="true" className="services-skeleton">
            {[0, 1, 2].map((item) => (
              <div key={item}>
                <span />
                <section>
                  <i />
                  <i />
                  <i />
                </section>
              </div>
            ))}
          </div>
        ) : resource.data?.items.length === 0 ? (
          <div className="services-state">
            <Wrench size={28} aria-hidden="true" />
            <h3>
              {cursor
                ? "No services on this page"
                : filtered
                  ? "No matching services"
                  : "Services are not listed yet"}
            </h3>
            <p>
              {filtered
                ? "Try other filters or contact our team about your vehicle."
                : "Contact our team to discuss the work your vehicle needs."}
            </p>
            <div className="actions">
              {(filtered || cursor) && (
                <button type="button" className="button secondary" onClick={clear}>
                  Show all services
                </button>
              )}
              <Link className="text-link" href="/contact">
                Contact Allied AutoTech <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          resource.data?.items.map((service) => (
            <article className="services-row" key={service.id}>
              <div className={`services-row-media${service.image ? " has-photo" : ""}`}>
                {service.image ? (
                  <ServicePhoto
                    key={`${service.image.id}:${service.image.url}`}
                    url={service.image.url}
                    alt={service.image.altText || service.name}
                    width={service.image.width}
                    height={service.image.height}
                  />
                ) : (
                  <>
                    <Wrench size={26} aria-hidden="true" />
                    <span>Image unavailable</span>
                  </>
                )}
              </div>
              <div className="services-row-copy">
                <h3>{service.name}</h3>
                {service.category && (
                  <p className="services-row-type">{service.category.name}</p>
                )}
                {service.pricingType === "FIXED" && (
                  <p className="services-row-type">Fixed price</p>
                )}
                <p className="services-row-description">
                  {service.shortDescription ||
                    service.description ||
                    "View this service for booking and quotation details."}
                </p>
                <p className="services-row-duration">
                  <Clock3 size={15} aria-hidden="true" />
                  {service.durationMinutes !== null && service.durationMinutes > 0
                    ? `Listed duration: ${service.durationMinutes} ${service.durationMinutes === 1 ? "minute" : "minutes"}`
                    : "Duration not listed"}
                </p>
              </div>
              <div className="services-row-actions">
                <div className="services-row-price">
                  <strong>
                    {service.pricingType === "QUOTE_REQUIRED"
                      ? "Quotation required"
                      : formatKobo(service.priceKobo)}
                  </strong>
                  <p>
                    {service.pricingType === "QUOTE_REQUIRED"
                      ? "Discuss your vehicle and the work needed."
                      : "Listed service price. Review details before requesting."}
                  </p>
                </div>
                <Link
                  href={`/services/${service.id}`}
                  className="text-link"
                  aria-label={`View ${service.name}`}
                >
                  View service <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
      {(cursor || resource.data?.nextCursor) && (
        <nav aria-label="Service pages" className="services-pagination">
          <button
            className="button secondary"
            type="button"
            disabled={!cursor || resource.loading || !!resource.error}
            onClick={() => {
              const next = new URLSearchParams(params);
              const previous = trail.at(-1);
              next.delete("cursor");
              next.delete("_trail");
              if (previous && previous !== "start") {
                next.set("cursor", previous);
                next.set("_trail", trail.slice(0, -1).join(","));
              }
              pageTo(next);
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {cursor && !trail.length ? "First page" : "Previous"}
          </button>
          <span>
            {cursor && !trail.length ? "More services" : `Page ${trail.length + 1}`}
          </span>
          <button
            className="button secondary"
            type="button"
            disabled={!resource.data?.nextCursor || resource.loading || !!resource.error}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("cursor", resource.data!.nextCursor!);
              const nextTrail = [...trail, cursor ?? "start"].join(",");
              if (
                (!cursor || trail.length) &&
                trail.length < 50 &&
                nextTrail.length <= 3500
              )
                next.set("_trail", nextTrail);
              else next.delete("_trail");
              pageTo(next);
            }}
          >
            Next
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}
    </>
  );
}
