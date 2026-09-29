"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Wrench } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseServices } from "@/lib/api/public-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
export function ServiceList({
  preview = false,
  initial,
}: {
  preview?: boolean;
  initial?: PublicSeed<ReturnType<typeof parseServices>>;
}) {
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [pricing, setPricing] = useState("");
  const CardHeading = preview ? "h3" : "h2";
  const params = new URLSearchParams({ limit: preview ? "3" : "12" });
  if (cursor) params.set("cursor", cursor);
  if (pricing) params.set("pricingType", pricing);
  const resource = useResource(
    `/public/services?${params}`,
    parseServices,
    initial?.data,
    { initialError: initial?.error, revalidateOnMount: false },
  );
  return (
    <>
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      {!preview && (
        <div className="field filter-field">
          <label htmlFor="service-pricing">Service type</label>
          <select
            id="service-pricing"
            value={pricing}
            onChange={(event) => {
              setPricing(event.target.value);
              setCursor(undefined);
              setHistory([]);
            }}
          >
            <option value="">All services</option>
            <option value="FIXED">Fixed price</option>
            <option value="QUOTE_REQUIRED">Quotation required</option>
          </select>
        </div>
      )}
      {resource.error && (
        <>
          <Feedback message={resource.error} />
          <button className="button secondary" onClick={resource.refresh}>
            Retry services
          </button>
        </>
      )}
      {resource.loading && (
        <p role="status" className="muted">
          {resource.data ? "Updating services…" : "Loading services…"}
        </p>
      )}
      <div
        className={`service-discovery${preview ? " service-discovery--preview" : ""}`}
        aria-busy={resource.loading}
      >
        {(!resource.error ? resource.data : undefined)?.items.map((service) => (
          <article className="service-discovery__item" key={service.id}>
            <Wrench className="service-discovery__icon" size={22} aria-hidden="true" />
            <div className="service-discovery__body">
              <p className="service-discovery__type">
                {service.pricingType === "QUOTE_REQUIRED"
                  ? "Custom Quote"
                  : "Standard Care"}
              </p>
              <CardHeading className="service-discovery__title">
                {service.name}
              </CardHeading>
              <p className="service-discovery__description">
                {service.shortDescription ??
                  service.description ??
                  "View this service for booking and quotation details."}
              </p>
              <div className="service-discovery__actions">
                <div>
                  <strong>
                    {service.pricingType === "QUOTE_REQUIRED"
                      ? "Request a quote"
                      : formatKobo(service.priceKobo)}
                  </strong>
                </div>
                <Link
                  aria-label={`View ${service.name}`}
                  className="text-link"
                  href={`/services/${service.id}`}
                >
                  View service <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!resource.loading && !resource.error && resource.data?.items.length === 0 && (
        <div className="empty">
          <CardHeading>
            {pricing ? "No matching services" : "Services are not listed yet"}
          </CardHeading>
          <p>Contact our team to discuss the work your vehicle needs.</p>
          <Link className="text-link" href="/contact">
            Contact Allied AutoTech →
          </Link>
          {pricing && (
            <p>
              <button className="button secondary" onClick={() => setPricing("")}>
                Show all services
              </button>
            </p>
          )}
        </div>
      )}
      {!preview && (
        <nav className="pagination" aria-label="Service pages">
          <button
            className="button secondary"
            disabled={history.length === 0 || resource.loading || !!resource.error}
            onClick={() => {
              setCursor(history.at(-1));
              setHistory((value) => value.slice(0, -1));
            }}
          >
            Previous
          </button>
          <span>Page {history.length + 1}</span>
          <button
            className="button secondary"
            disabled={!resource.data?.nextCursor || resource.loading || !!resource.error}
            onClick={() => {
              setHistory((value) => [...value, cursor]);
              setCursor(resource.data?.nextCursor);
            }}
          >
            Next
          </button>
        </nav>
      )}
    </>
  );
}
