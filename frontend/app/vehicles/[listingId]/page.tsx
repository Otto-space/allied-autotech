import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import { publicData, PublicApiError } from "@/lib/api/public-server";
import { listingSchema } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { formatBusinessDate } from "@/lib/format/date";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { PublicMedia } from "../../components/public-media";
import { VehicleActions } from "../../components/vehicle-actions";
const getListing = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    return await publicData(`/public/vehicles/${id}`, (value) => {
      const parsed = listingSchema.parse(value);
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
      listing.title,
      (
        listing.description ??
        `Explore ${listing.title} at Allied AutoTech and request an inspection.`
      ).slice(0, 160),
      `/vehicles/${listing.id}`,
      searchParams,
    );
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Vehicle details", robots: { index: false } };
  }
}
export default async function ListingPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const listing = await getListing((await params).listingId);
  const vehicle = listing.vehicle;
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/vehicles">Vehicles</Link>
            <span aria-hidden="true">/</span>
            <span>{listing.title}</span>
          </nav>
          <div className="product-detail-grid">
            <div>
              <PublicMedia
                src={
                  (vehicle.images.find((image) => image.isPrimary) ?? vehicle.images[0])
                    ?.url
                }
                alt={listing.title}
                priority
              />
              <div className="gallery-grid">
                {vehicle.images.slice(1).map((image) => (
                  <PublicMedia
                    src={image.url}
                    key={image.id}
                    alt={image.altText ?? listing.title}
                  />
                ))}
              </div>
              <section className="detail-section">
                <h2>Vehicle details</h2>
                <dl className="totals">
                  {Object.entries({
                    Year: vehicle.year,
                    Make: vehicle.make,
                    Model: vehicle.model,
                    Mileage:
                      vehicle.mileageKm === null
                        ? "Not listed"
                        : `${vehicle.mileageKm.toLocaleString("en-NG")} km`,
                    Transmission: vehicle.transmission ?? "Not listed",
                    Fuel: vehicle.fuelType ?? "Not listed",
                    Condition: vehicle.condition,
                    Colour: vehicle.color ?? "Not listed",
                  }).map(([label, value]) => (
                    <div className="spec-row" key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {vehicle.conditionReports.map((report) => (
                <section className="detail-section" key={report.id}>
                  <h2>Listed condition report</h2>
                  <p>{report.summary}</p>
                  <p className="muted">
                    Inspected {formatBusinessDate(report.inspectedAt)}
                  </p>
                </section>
              ))}
            </div>
            <div>
              <p className="muted">
                {listing.branch.name} · {listing.branch.city}
              </p>
              <h1>{listing.title}</h1>
              <p className="price">{formatKobo(listing.priceKobo)}</p>
              <p className="lead">
                {listing.description ??
                  "Speak with our team for more information about this vehicle."}
              </p>
              <VehicleActions listingId={listing.id} />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
