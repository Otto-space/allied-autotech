import { browseEnquiriesOnly } from "@/lib/public-launch";
import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import { headers } from "next/headers";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  MapPin,
  MessageCircle,
  Package,
} from "lucide-react";
import { notFound, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  indexingEnabled,
  siteOrigin,
  serializeStructuredData,
  publicPageMetadata,
  type SearchParameters,
} from "@/lib/seo";
import { publicData, PublicApiError } from "@/lib/api/public-server";
import { productSchema, parseProducts, type Product } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { business } from "@/lib/business";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { ProductGallery } from "./product-gallery";
import { PublicMedia } from "../../components/public-media";
import "./product-detail.css";
import { ProductActions } from "../../components/product-actions";
const getProduct = cache(async (id: string) => {
  if (!z.uuid().safeParse(id).success) notFound();
  try {
    return await publicData(`/public/catalog/products/${id}`, (value) => {
      const parsed = productSchema.parse(value);
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
  params: Promise<{ productId: string }>;
  searchParams: SearchParameters;
}): Promise<Metadata> {
  const { productId } = await params;
  try {
    const product = await getProduct(productId);
    return publicPageMetadata(
      product.name,
      (
        product.description ??
        `${product.name} at Allied AutoTech. Check vehicle compatibility and branch availability.`
      ).slice(0, 160),
      `/parts/${product.id}`,
      searchParams,
    );
  } catch (error) {
    unstable_rethrow(error);
    return { title: "Part details", robots: { index: false } };
  }
}
async function RelatedProducts({ product }: { product: Product }) {
  let items: Product[] = [];
  let failed = false;
  const query = new URLSearchParams({ categoryId: product.category.id, limit: "3" });
  try {
    items = (await publicData(`/public/catalog/products?${query}`, parseProducts)).items
      .filter(
        (item) => item.id !== product.id && item.category.id === product.category.id,
      )
      .slice(0, 2);
  } catch (error) {
    unstable_rethrow(error);
    failed = true;
  }
  return (
    <section className="pd-related" aria-labelledby="pd-related-title">
      <div className="pd-section-heading">
        <h2 id="pd-related-title">More in {product.category.name}</h2>
        <Link
          className="pd-link"
          href={`/parts?${new URLSearchParams({ categoryId: product.category.id })}`}
        >
          Browse category <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      {items.length ? (
        <div className="pd-related-grid">
          {items.map((item) => (
            <Link className="pd-related-item" key={item.id} href={`/parts/${item.id}`}>
              <PublicMedia
                src={
                  (item.images.find((photo) => photo.isPrimary) ?? item.images[0])?.url
                }
                alt={item.name}
                sizes="130px"
                fallbackIcon={<Package size={24} strokeWidth={1.3} />}
              />
              <div>
                <h3>{item.name}</h3>
                {item.brand && <p>{item.brand}</p>}
                <strong>{formatKobo(item.priceKobo)}</strong>
                <span>
                  View product <ArrowRight size={16} aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="pd-muted">
          {failed
            ? "Other products are temporarily unavailable. You can try the shop catalogue."
            : "No other products in this category are shown right now. Browse the shop or ask our team for help."}
        </p>
      )}
    </section>
  );
}
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: SearchParameters;
}) {
  const product = await getProduct((await params).productId);
  const available = product.availability.some((item) => item.inStock);
  const compare =
    product.compareAtPriceKobo &&
    BigInt(product.compareAtPriceKobo) > BigInt(product.priceKobo)
      ? product.compareAtPriceKobo
      : null;
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
                  name: "Shop",
                  item: `${origin}/parts`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: product.name,
                  item: `${origin}/parts/${product.id}`,
                },
              ],
            },
            {
              "@type": "Product",
              name: product.name,
              sku: product.sku,
              ...(product.brand
                ? { brand: { "@type": "Brand", name: product.brand } }
                : {}),
              ...(product.manufacturerPartNumber
                ? { mpn: product.manufacturerPartNumber }
                : {}),
              ...(product.description ? { description: product.description } : {}),
              offers: {
                "@type": "Offer",
                priceCurrency: "NGN",
                price: `${BigInt(product.priceKobo) / BigInt(100)}.${String(BigInt(product.priceKobo) % BigInt(100)).padStart(2, "0")}`,
                url: `${origin}/parts/${product.id}`,
                ...(product.availability.length
                  ? {
                      availability: `https://schema.org/${available ? "InStock" : "OutOfStock"}`,
                    }
                  : {}),
              },
            },
          ],
        }
      : null;
  const specs = {
    Brand: product.brand || "Not listed",
    Category: product.category.name,
    SKU: product.sku,
    "Part number": product.manufacturerPartNumber || "Not listed",
  };
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site product-detail">
        {structured && (
          <script
            type="application/ld+json"
            nonce={(await headers()).get("x-nonce") ?? undefined}
            dangerouslySetInnerHTML={{ __html: serializeStructuredData(structured) }}
          />
        )}
        <div className="pd-container">
          <nav className="pd-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link href="/parts">Shop</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page" title={product.name}>
                  {product.name}
                </span>
              </li>
            </ol>
          </nav>
          <header className="pd-heading">
            <h1>{product.name}</h1>
            <p>
              {product.brand && <>{product.brand} &middot; </>}
              {product.category.name}
            </p>
            <div className="pd-mobile-price">
              <strong>{formatKobo(product.priceKobo)}</strong>
              {compare && (
                <span>
                  <span className="sr-only">Comparison price </span>
                  <del>{formatKobo(compare)}</del>
                </span>
              )}
              <span className="pd-unit">Price per item</span>
            </div>
          </header>
          <nav className="pd-section-nav" aria-label="Product sections">
            <a href="#product-overview">Overview</a>
            <a href="#product-information">Product information</a>
            <a href="#product-compatibility">Compatibility</a>
            <a href="#product-delivery">Delivery</a>
          </nav>
          <div className="pd-top-grid">
            <div className="pd-gallery-frame" id="product-overview">
              <ProductGallery
                key={product.id}
                images={product.images}
                title={product.name}
              />
              <dl className="pd-identifiers">
                {Object.entries({
                  Brand: product.brand || "Not listed",
                  "Part number": product.manufacturerPartNumber || "Not listed",
                  SKU: product.sku,
                }).map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <section className="pd-purchase" aria-label="Price and ordering">
              <div className="pd-price-row">
                <strong>{formatKobo(product.priceKobo)}</strong>
                {compare && (
                  <span>
                    <span className="sr-only">Comparison price </span>
                    <del>{formatKobo(compare)}</del>
                  </span>
                )}
              </div>
              <p className="pd-hint">Price per item</p>
              <section className="pd-availability" aria-labelledby="pd-stock-heading">
                <h2 id="pd-stock-heading">Branch availability</h2>
                {product.availability.length ? (
                  <ul>
                    {product.availability.map((item) => (
                      <li key={item.branch.id}>
                        <span>
                          <MapPin size={17} aria-hidden="true" />
                          {item.branch.name}
                        </span>
                        <strong className={item.inStock ? "pd-in-stock" : ""}>
                          {item.inStock && <CheckCircle2 size={16} aria-hidden="true" />}
                          {item.inStock ? "In stock" : "Unavailable"}
                        </strong>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Availability has not been listed. Contact our team to check.</p>
                )}
                {!available && !!product.availability.length && (
                  <p>
                    Currently unavailable. Save this product or contact our team for help.
                  </p>
                )}
              </section>
              <ProductActions
                key={product.id}
                productId={product.id}
                productName={product.name}
                available={available}
              />
            </section>
          </div>
          <aside className="pd-assistance">
            <MessageCircle size={28} aria-hidden="true" />
            <h2>Need help choosing the right part?</h2>
            <p>Check the part number and compatibility before ordering.</p>
            <Link href="/contact#enquiry">
              Ask our team <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </aside>
          <div className="pd-details-grid">
            <section id="product-information" aria-labelledby="pd-info-title">
              <h2 id="pd-info-title">Product information</h2>
              <p className="pd-description">
                {product.description ||
                  "Contact our team if you need more information about this product."}
              </p>
              <dl className="pd-specs">
                {Object.entries(specs).map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section
              className="pd-compatibility"
              id="product-compatibility"
              aria-labelledby="pd-compatibility-title"
            >
              <h2 id="pd-compatibility-title">Vehicle compatibility</h2>
              <p>
                Match your make, model and year. Confirm fitment with our team before
                ordering.
              </p>
              {product.compatibilities.length ? (
                <ul>
                  {product.compatibilities.map((item) => (
                    <li key={item.id}>
                      <div>
                        <h3>
                          {item.make}
                          {item.model ? ` ${item.model}` : " (model not listed)"}
                        </h3>
                        <span>
                          {item.yearFrom != null && item.yearTo != null
                            ? `${item.yearFrom}–${item.yearTo}`
                            : item.yearFrom != null
                              ? `From ${item.yearFrom}`
                              : item.yearTo != null
                                ? `Up to ${item.yearTo}`
                                : "Years not listed"}
                        </span>
                      </div>
                      {item.notes && <p>{item.notes}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="pd-empty">
                  Compatibility has not been listed. Confirm the product is suitable for
                  your vehicle with our team before ordering.
                </p>
              )}
              <Link className="pd-link" href="/contact#enquiry">
                Ask about compatibility <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </section>
          </div>
          <section
            className="pd-ordering"
            id="product-delivery"
            aria-labelledby="pd-ordering-title"
          >
            <div>
              <h2 id="pd-ordering-title">Delivery and ordering</h2>
              <ol className="pd-ordering-steps">
                <li>
                  <span aria-hidden="true">01</span>
                  <div>
                    <h3>Check the fit</h3>
                    <p>Match the part number and your vehicle before ordering.</p>
                  </div>
                </li>
                <li>
                  <span aria-hidden="true">02</span>
                  <div>
                    <h3>
                      {browseEnquiriesOnly()
                        ? "Ask about availability"
                        : "Review your cart"}
                    </h3>
                    <p>
                      {browseEnquiriesOnly()
                        ? "Tell our team which part and quantity you need."
                        : "Save the total quantity you need. Cart items do not reserve stock."}
                    </p>
                  </div>
                </li>
                <li>
                  <span aria-hidden="true">03</span>
                  <div>
                    <h3>
                      {browseEnquiriesOnly()
                        ? "Discuss collection or delivery"
                        : "Choose fulfilment"}
                    </h3>
                    <p>
                      {browseEnquiriesOnly()
                        ? "Our team will confirm the available options and charges."
                        : "Review collection or available delivery options at checkout."}
                    </p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="pd-ordering-faq">
              <h3>Before you order</h3>
              <details>
                <summary>
                  Where can I collect my order?
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>
                  {business.address}.{" "}
                  {browseEnquiriesOnly()
                    ? "Contact our team before visiting to confirm availability and collection arrangements."
                    : "Follow the collection instructions in your order before visiting."}
                </p>
              </details>
              <details>
                <summary>
                  Can this product be delivered?
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>
                  {browseEnquiriesOnly()
                    ? "Contact our team to confirm whether delivery is available to your area and request the delivery charge."
                    : "Checkout shows the currently available delivery areas and charges. If your area is not listed, contact our team for help."}
                </p>
                <Link className="pd-link" href="/contact#enquiry">
                  Ask about delivery <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </details>
            </div>
          </section>
          <Suspense
            fallback={
              <section className="pd-related" role="status">
                <h2>More in {product.category.name}</h2>
                <p>Loading related products…</p>
              </section>
            }
          >
            <RelatedProducts product={product} />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
