"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { featuredServices } from "@/lib/featured-services";
import { parseServices } from "@/lib/api/public-schemas";
import type { PublicSeed } from "@/lib/api/public-seed";
import { formatKobo } from "@/lib/format/money";
import { useResource } from "@/lib/api/use-resource";
import { Feedback } from "./feedback";

export function HomeFeaturedServices({
  initial,
}: {
  initial: PublicSeed<ReturnType<typeof parseServices>>;
}) {
  const resource = useResource("/public/services?limit=50", parseServices, initial.data, {
    initialError: initial.error,
    revalidateOnMount: false,
  });
  return (
    <>
      <Feedback message={resource.error || resource.refreshError} />
      {(resource.error || resource.refreshError) && (
        <button className="button secondary" onClick={resource.refresh}>
          Retry services
        </button>
      )}

      <div className="home-feature-grid">
        {featuredServices.map((item) => {
          // Exact names only: a quick scan is not comprehensive diagnostics; basic oil is not generic lube.
          const matches =
            resource.data?.items.filter(
              (record) => record.name.toLowerCase() === item.name.toLowerCase(),
            ) ?? [];
          const record = matches.length === 1 ? matches[0] : undefined;
          const href = record
            ? `/services/${record.id}`
            : `/contact?serviceInterest=${item.key}#enquiry`;
          return (
            <article className="home-feature-card" key={item.key}>
              <div className="home-feature-media">
                <Image
                  src={`/images/workshop/owner/${item.image}.webp`}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 700px) 90vw, (max-width: 1000px) 44vw, 380px"
                />
              </div>
              <div className="home-feature-body">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                {item.key === "oil-service" && (
                  <small>Illustrative service photograph.</small>
                )}
                <p className="home-feature-price">
                  {record
                    ? record.pricingType === "FIXED" && record.priceKobo !== null
                      ? formatKobo(record.priceKobo, { hideZeroDecimals: true })
                      : "Scope and quotation with the team"
                    : "Discuss scope and pricing with the team"}
                </p>
                <Link
                  className="text-link"
                  href={href}
                  aria-label={`${record ? "View" : "Ask about"} ${item.name}`}
                >
                  {record ? "View service" : "Ask about this service"}{" "}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
