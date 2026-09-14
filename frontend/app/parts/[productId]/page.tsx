import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { publicData, PublicApiError } from "@/lib/api/public-server";
import { productSchema } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { PublicMedia } from "../../components/public-media";
import { ProductActions } from "../../components/product-actions";
const getProduct = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  try {
    return await publicData(`/public/catalog/products/${id}`, (value) =>
      productSchema.parse(value),
    );
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
});
export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  try {
    const product = await getProduct(productId);
    return {
      title: product.name,
      description: (
        product.description ??
        `${product.name} at Allied AutoTech. Check vehicle compatibility and branch availability.`
      ).slice(0, 160),
    };
  } catch {
    return { title: "Part details", robots: { index: false } };
  }
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const product = await getProduct((await params).productId);
  return (
    <>
      <SiteHeader />
      <main id="main" className="section">
        <div className="container">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/parts">Parts</Link>
            <span aria-hidden="true">/</span>
            <span>{product.name}</span>
          </nav>
          <div className="product-detail-grid">
            <div>
              <PublicMedia
                src={
                  (product.images.find((image) => image.isPrimary) ?? product.images[0])
                    ?.url
                }
                alt={product.name}
                priority
              />
              {product.images.length > 1 && (
                <div className="gallery-grid">
                  {product.images.map((image) => (
                    <PublicMedia
                      key={image.id}
                      src={image.url}
                      alt={image.altText ?? product.name}
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <p className="muted">
                {product.category.name} · {product.sku}
              </p>
              <h1>{product.name}</h1>
              <p className="price">{formatKobo(product.priceKobo)}</p>
              <p className="lead">
                {product.description ??
                  "Contact our team if you need more information about this part."}
              </p>
              {product.availability.map((item) => (
                <p key={item.branch.id} className="stock-label">
                  {item.branch.name}: {item.inStock ? "In stock" : "Unavailable"}
                </p>
              ))}
              <p className="field-hint">
                Availability is checked again at checkout. Adding a part to your cart does
                not reserve it.
              </p>
              <ProductActions
                productId={product.id}
                available={product.availability.some((item) => item.inStock)}
              />
            </div>
          </div>
          <section className="detail-section">
            <h2>Vehicle compatibility</h2>
            {product.compatibilities.length ? (
              <div className="list">
                {product.compatibilities.map((item) => (
                  <article className="card" key={item.id}>
                    <h3>
                      {item.make} {item.model}
                    </h3>
                    <p>
                      {item.yearFrom ?? "Start year not specified"} –{" "}
                      {item.yearTo ?? "End year not specified"}
                    </p>
                    {item.notes && <p>{item.notes}</p>}
                  </article>
                ))}
              </div>
            ) : (
              <p className="muted">
                Compatibility has not been listed. Confirm the part is suitable for your
                vehicle with our team before ordering.
              </p>
            )}
            <p>
              <Link className="text-link" href="/contact">
                Ask about compatibility →
              </Link>
            </p>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
