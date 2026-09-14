"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Wrench } from "lucide-react";
import { useResource } from "@/lib/api/use-resource";
import { parseServices } from "@/lib/api/public-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
export function ServiceList({ preview = false }: { preview?: boolean }) {
  const [cursor, setCursor] = useState<string | undefined>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [pricing, setPricing] = useState("");
  const params = new URLSearchParams({ limit: preview ? "3" : "12" });
  if (cursor) params.set("cursor", cursor);
  if (pricing) params.set("pricingType", pricing);
  const resource = useResource(`/public/services?${params}`, parseServices);
  return (
    <>
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
      <div className="grid" aria-busy={resource.loading}>
        {resource.data?.items.map((service) => (
          <article className="card service-card" key={service.id}>
            <Wrench size={26} />
            <h3>{service.name}</h3>
            <p>
              {service.shortDescription ??
                service.description ??
                "View this service to discuss your vehicle’s needs."}
            </p>
            <div className="card-meta">
              <strong>
                {service.pricingType === "QUOTE_REQUIRED"
                  ? "Request a quote"
                  : formatKobo(service.priceKobo)}
              </strong>
              <Link
                aria-label={`View ${service.name}`}
                className="text-link"
                href={`/services/${service.id}`}
              >
                <ArrowUpRight size={23} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!resource.loading && !resource.error && resource.data?.items.length === 0 && (
        <div className="empty">
          <h3>{pricing ? "No matching services" : "Services are not listed yet"}</h3>
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
            disabled={history.length === 0 || resource.loading}
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
            disabled={!resource.data?.nextCursor || resource.loading}
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
