"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Wrench, X } from "lucide-react";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useResource } from "@/lib/api/use-resource";
import { parseServices } from "@/lib/api/public-schemas";
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
  initial: PublicSeed<ReturnType<typeof parseServices>>;
}) {
  const searchParams = useSearchParams();
  const { params, invalid } = normalizeServiceQuery(
    new URLSearchParams(searchParams.toString()),
  );
  const pricing = params.get("pricingType") ?? "";
  const cursor = params.get("cursor");
  const trail = params.get("_trail")?.split(",") ?? [];
  const resource = useResource(serviceApiPath(params), parseServices, initial.data, {
    initialError: initial.error,
    revalidateOnMount: false,
  });
  function navigate(next: URLSearchParams) {
    const query = normalizeServiceQuery(next).params.toString();
    const url = `/services${query ? `?${query}` : ""}${window.location.hash}`;
    if (
      url !==
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      window.history.pushState(null, "", url);
  }
  function filter(value: string, restoreFocus = false) {
    const next = new URLSearchParams();
    if (value) next.set("pricingType", value);
    navigate(next);
    if (restoreFocus) document.getElementById("service-type-all")?.focus();
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
      <div className="services-results-heading">
        <h2 id="service-results-heading" tabIndex={-1}>
          Find your service
        </h2>
        <p role="status" aria-live="polite">
          {resource.loading
            ? "Loading services…"
            : resource.error
              ? "Services unavailable"
              : `${resource.data?.items.length ?? 0} service${resource.data?.items.length === 1 ? "" : "s"} on this page`}
        </p>
      </div>
      {invalid && (
        <p className="notice">
          Some filters in this link were invalid and have been ignored. Review the service
          type below.
        </p>
      )}
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
      <div className="services-filter-summary">
        {pricing ? (
          <>
            <button
              className="services-chip"
              type="button"
              aria-label={`Remove ${pricingLabel} filter`}
              onClick={() => filter("", true)}
            >
              {pricingLabel}
              <X size={14} aria-hidden="true" />
            </button>
            <button
              className="services-clear"
              type="button"
              onClick={() => filter("", true)}
            >
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
              <button type="button" className="button" onClick={resource.refresh}>
                Retry services
              </button>
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
                : pricing
                  ? "No matching services"
                  : "Services are not listed yet"}
            </h3>
            <p>
              {pricing
                ? "Try another service type or contact our team about your vehicle."
                : "Contact our team to discuss the work your vehicle needs."}
            </p>
            <div className="actions">
              {(pricing || cursor) && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => filter("", true)}
                >
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
                    key={service.image.id}
                    url={service.image.url}
                    alt={service.image.altText || service.name}
                    width={service.image.width}
                    height={service.image.height}
                  />
                ) : (
                  <Wrench size={26} aria-hidden="true" />
                )}
              </div>
              <div className="services-row-copy">
                <h3>{service.name}</h3>
                <p className="services-row-type">
                  {service.pricingType === "FIXED" ? "Fixed price" : "Quotation required"}
                </p>
                <p className="services-row-description">
                  {service.shortDescription ||
                    service.description ||
                    "View this service for booking and quotation details."}
                </p>
              </div>
              <div className="services-row-actions">
                <strong>
                  {service.pricingType === "QUOTE_REQUIRED"
                    ? "Quotation required"
                    : formatKobo(service.priceKobo)}
                </strong>
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
              if ((!cursor || trail.length) && trail.length < 50)
                next.set("_trail", [...trail, cursor ?? "start"].join(","));
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
