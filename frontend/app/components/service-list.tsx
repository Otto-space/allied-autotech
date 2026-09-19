"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8" aria-busy={resource.loading}>
        {(!resource.error ? resource.data : undefined)?.items.map((service) => (
          <article
            className="border border-line rounded bg-white flex flex-col group overflow-hidden"
            key={service.id}
          >
            <div className="aspect-4/3 bg-surface flex items-center justify-center text-xs text-muted font-mono relative overflow-hidden">
              <span className="z-10 bg-white/80 px-2 py-1 rounded">Service Image</span>
              {/* Minimal zoom effect on hover */}
              <div className="absolute inset-0 bg-ink/5 transition-transform duration-500 group-hover:scale-105" />
            </div>
            <div className="p-8 flex flex-col flex-1">
              <p className="eyebrow mb-3">
                {service.pricingType === "QUOTE_REQUIRED"
                  ? "Custom Quote"
                  : "Standard Care"}
              </p>
              <CardHeading className="text-2xl font-display font-bold text-ink leading-tight mb-3">
                {service.name}
              </CardHeading>
              <p className="text-muted text-sm flex-1 mb-8">
                {service.shortDescription ??
                  service.description ??
                  "View this service for booking and quotation details."}
              </p>
              <div className="flex justify-between items-end border-t border-line pt-6 mt-auto">
                <div>
                  <p className="text-xs text-muted font-bold uppercase tracking-wider mb-1">
                    Cost
                  </p>
                  <strong className="text-xl font-display">
                    {service.pricingType === "QUOTE_REQUIRED"
                      ? "Request a quote"
                      : formatKobo(service.priceKobo)}
                  </strong>
                </div>
                <Link
                  aria-label={`View ${service.name}`}
                  className="w-12 h-12 rounded-full border border-line flex items-center justify-center text-ink hover:bg-brand-red hover:text-white hover:border-brand-red transition-all group/btn"
                  href={`/services/${service.id}`}
                >
                  <ArrowUpRight
                    size={20}
                    className="group-hover/btn:rotate-12 transition-transform"
                  />
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
