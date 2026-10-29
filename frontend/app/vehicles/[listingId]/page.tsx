import { engineLitres, vehiclePresentation } from "@/lib/vehicle-presentation";
import { VehicleOwnerDisclosure } from "../../components/vehicle-owner-disclosure";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { Suspense } from "react";
import { ArrowRight, CarFront, ChevronRight, MapPin } from "lucide-react";
import { cache } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  indexingEnabled,
  publicPageMetadata,
  serializeStructuredData,
  siteOrigin,
  type SearchParameters,
} from "@/lib/seo";
import { publicData, PublicApiError } from "@/lib/api/public-server";
import { listingSchema, parseListings } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { PublicMedia } from "../../components/public-media";
import { VehicleGallery } from "./vehicle-gallery";
import { mileageLabel } from "@/lib/vehicle-detail";
import { vehicleLabel } from "@/lib/vehicle-discovery";
import "./vehicle-detail.css";
import { VehicleActions } from "../../components/vehicle-actions";
import { vehicleEnquiryHref } from "@/lib/catalogue-enquiry";
const getListing = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    return await publicData(`/public/vehicles/${id}`, (value) => {
      const parsed = listingSchema
        .extend({
          vehicle: listingSchema.shape.vehicle.extend({
            engineSize: z.string().nullable().optional(),
            driveType: z.string().nullable().optional(),
            doors: z.number().nullable().optional(),
            seats: z.number().nullable().optional(),
          }),
        })
        .parse(value);
      if (parsed.id !== id) throw new PublicApiError(502);
      return parsed;
    });
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
});
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: SearchParameters;
}): Promise<Metadata> {
  try {
    const listing = await getListing((await params).listingId);
    return publicPageMetadata(
      vehiclePresentation(listing.vehicle).title,
      (
        listing.description ??
        `Explore ${vehiclePresentation(listing.vehicle).title} at Allied AutoTech and request an inspection.`
      ).slice(0, 160),
      `/vehicles/${listing.id}`,
      searchParams,
    );
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Vehicle details", robots: { index: false } };
  }
}
async function RelatedVehicles({ make, listingId }: { make: string; listingId: string }) {
  const query = new URLSearchParams({ make, limit: "3" });
  let items: ReturnType<typeof parseListings>["items"] = [];
  let unavailable = false;
  try {
    items = (await publicData(`/public/vehicles?${query}`, parseListings)).items
      .filter(
        (item) =>
          item.id !== listingId && item.vehicle.make.toLowerCase() === make.toLowerCase(),
      )
      .slice(0, 2);
  } catch (error) {
    unstable_rethrow(error);
    unavailable = true;
  }
  return (
    <section className="vd-related" aria-labelledby="vd-related-title">
      <div className="vd-section-heading">
        <h2 id="vd-related-title">Explore more from {make}</h2>
        <Link href={`/vehicles?${new URLSearchParams({ make })}`}>
          Browse vehicles <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      {items.length ? (
        <div className="vd-related-grid">
          {items.map((item) => (
            <Link className="vd-related-item" key={item.id} href={`/vehicles/${item.id}`}>
              <PublicMedia
                src={
                  (
                    item.vehicle.images.find((image) => image.isPrimary) ??
                    item.vehicle.images[0]
                  )?.url
                }
                alt={item.title}
                fallbackIcon={<CarFront size={24} strokeWidth={1.3} />}
                sizes="120px"
              />
              <div>
                <h3>{item.title}</h3>
                <p>
                  {item.vehicle.year} &middot; {mileageLabel(item.vehicle.mileageKm)}
                </p>
                <strong>{formatKobo(item.priceKobo)}</strong>
              </div>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="vd-muted">
          {unavailable
            ? "Other listings are temporarily unavailable. You can try the vehicle catalogue."
            : "No other matching listings are shown right now. Browse all vehicles or ask our team about what you need."}
        </p>
      )}
    </section>
  );
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: SearchParameters;
}) {
  const listing = await getListing((await params).listingId);
  const enquiryHref = vehicleEnquiryHref(
    new URLSearchParams(
      Object.entries(await searchParams).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : [],
      ),
    ),
    listing.id,
  );
  const vehicle = listing.vehicle;
  const presentation = vehiclePresentation(vehicle);
  const label = (value: string | null | undefined) =>
    value ? vehicleLabel(value) : "Not listed";
  const specs = {
    Year: vehicle.year,
    Make: vehicle.make,
    Model: vehicle.model,
    Trim: vehicle.trim || "Not listed",
    "Body type": label(vehicle.bodyType),
    Mileage: mileageLabel(vehicle.mileageKm),
    Transmission: label(vehicle.transmission),
    "Fuel type": label(vehicle.fuelType),
    Condition: label(vehicle.condition),
    "Final assembly country": label(vehicle.manufactureCountryCode),
    Powertrain: label(vehicle.powertrain),
    ...(vehicle.engineCapacityCc == null
      ? {}
      : {
          "Engine capacity": `${engineLitres(vehicle.engineCapacityCc)} (${vehicle.engineCapacityCc.toLocaleString("en-NG")} cc)`,
        }),
    ...(vehicle.features?.length
      ? { "Recorded features": vehicle.features.join(", ") }
      : {}),
    Colour: vehicle.color || "Not listed",
    ...(vehicle.engineCode ? { "Engine code": vehicle.engineCode } : {}),
    ...(vehicle.cylinders != null ? { Cylinders: vehicle.cylinders } : {}),
    ...(vehicle.engineSize ? { "Engine size": vehicle.engineSize } : {}),
    ...(vehicle.driveType
      ? { "Drive type": vehicle.driveType === "FOUR_WD" ? "4WD" : vehicle.driveType }
      : {}),
    ...(vehicle.doors != null ? { Doors: vehicle.doors } : {}),
    ...(vehicle.seats != null ? { Seats: vehicle.seats } : {}),
  };
  const origin = siteOrigin();
  const structured =
    indexingEnabled() && origin && !Object.keys(await searchParams).length
      ? {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Vehicles",
                  item: `${origin}/vehicles`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: listing.title,
                  item: `${origin}/vehicles/${listing.id}`,
                },
              ],
            },
            {
              "@type": "Vehicle",
              name: listing.title,
              brand: { "@type": "Brand", name: vehicle.make },
              model: vehicle.model,
              ...(listing.description ? { description: listing.description } : {}),
              offers: {
                "@type": "Offer",
                priceCurrency: listing.currency,
                price: `${BigInt(listing.priceKobo) / BigInt(100)}.${(BigInt(listing.priceKobo) % BigInt(100)).toString().padStart(2, "0")}`,
                url: `${origin}/vehicles/${listing.id}`,
              },
            },
          ],
        }
      : undefined;
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site vehicle-detail">
        {structured && (
          <script
            type="application/ld+json"
            nonce={(await headers()).get("x-nonce") ?? undefined}
            dangerouslySetInnerHTML={{ __html: serializeStructuredData(structured) }}
          />
        )}
        <div className="vd-container">
          <nav className="vd-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link href="/vehicles">Vehicles</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page" title={presentation.title}>
                  {presentation.title}
                </span>
              </li>
            </ol>
          </nav>
          <header className="vd-heading">
            <p>
              {vehicle.year} &middot; {label(vehicle.condition)} &middot;{" "}
              {listing.branch.city}
            </p>
            <h1>{presentation.title}</h1>
            {presentation.subtitle && <p>{presentation.subtitle}</p>}
            <p>Published listing &middot; Confirm current availability with our team.</p>
            <p className="vd-mobile-price">
              {formatKobo(listing.priceKobo, { hideZeroDecimals: true })}
            </p>
          </header>
          <nav className="vd-section-nav" aria-label="Vehicle sections">
            <a href="#vehicle-overview">Overview</a>
            <a href="#vehicle-specifications">Specifications</a>
            <a href="#vehicle-condition">Condition</a>
            <a href="#inspection">Inspection</a>
          </nav>
          <VehicleActions
            enquiryHref={enquiryHref}
            key={listing.id}
            listingId={listing.id}
            listingTitle={presentation.title}
            branchName={listing.branch.name}
            gallery={
              <div className="vd-gallery-column" id="vehicle-overview">
                <VehicleGallery images={vehicle.images} title={presentation.title} />
                <dl className="vd-highlights">
                  <div>
                    <dt>Body type</dt>
                    <dd>{label(vehicle.bodyType)}</dd>
                  </div>
                  <div>
                    <dt>Trim</dt>
                    <dd>{vehicle.trim || "Not listed"}</dd>
                  </div>
                  <div>
                    <dt>Condition report</dt>
                    <dd>
                      {vehicle.conditionReports.length ? "Published" : "Not published"}
                    </dd>
                  </div>
                </dl>
              </div>
            }
            summary={
              <>
                <p className="vd-price-label">Listed price</p>
                <p className="vd-price">
                  {formatKobo(listing.priceKobo, { hideZeroDecimals: true })}
                </p>
                <dl className="vd-quick-facts">
                  {Object.entries({
                    Mileage: mileageLabel(vehicle.mileageKm),
                    Transmission: label(vehicle.transmission),
                    Fuel: label(vehicle.fuelType),
                  }).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <VehicleOwnerDisclosure vehicle={vehicle} />
                <p className="vd-branch">
                  <MapPin size={19} aria-hidden="true" />
                  <span>
                    {listing.branch.name}
                    <small>
                      {listing.branch.city}, {listing.branch.state}
                    </small>
                  </span>
                </p>
              </>
            }
          >
            <section
              className="vd-details"
              id="vehicle-specifications"
              aria-labelledby="vd-details-title"
            >
              <h2 id="vd-details-title">The details that matter.</h2>
              <div className="vd-details-grid">
                <div>
                  <dl className="vd-specs">
                    {Object.entries(specs).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="vd-description">
                    <h3>About this vehicle</h3>
                    <p>
                      {listing.description ||
                        "Ask our team for more information about this vehicle, or request an inspection to see it in person."}
                    </p>
                  </div>
                </div>
                <section
                  className="vd-condition"
                  id="vehicle-condition"
                  aria-labelledby="vd-condition-title"
                >
                  <h3 id="vd-condition-title">Listed condition report</h3>
                  {vehicle.conditionReports.length ? (
                    vehicle.conditionReports.map((report) => (
                      <div key={report.id}>
                        <p className="vd-muted">
                          Inspected {formatBusinessDate(report.inspectedAt)}
                        </p>
                        <p className="vd-report-copy">{report.summary}</p>
                        <dl className="vd-report-facts">
                          {report.odometerKm !== null && (
                            <div>
                              <dt>Recorded odometer</dt>
                              <dd>{mileageLabel(report.odometerKm)}</dd>
                            </div>
                          )}
                          {report.conditionScore !== null && (
                            <div>
                              <dt>Listed condition score</dt>
                              <dd>{report.conditionScore} / 100</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    ))
                  ) : (
                    <p className="vd-muted">
                      No condition report is published for this listing. Ask our team
                      about its condition when arranging your inspection.
                    </p>
                  )}
                </section>
              </div>
            </section>
          </VehicleActions>
          <Suspense
            fallback={
              <section className="vd-related" aria-busy="true">
                <h2>More vehicles</h2>
                <p role="status">Loading related listings…</p>
              </section>
            }
          >
            <RelatedVehicles make={vehicle.make} listingId={listing.id} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
