"use client";
import type { PublicSeed } from "@/lib/api/public-seed";
import { useState } from "react";
import Link from "next/link";
import { useResource } from "@/lib/api/use-resource";
import { parseCategories, parseProducts } from "@/lib/api/commerce-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
export function PartsCatalogue({
  initial,
}: {
  initial?: PublicSeed<ReturnType<typeof parseProducts>>;
}) {
  const [filters, setFilters] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<(string | undefined)[]>([]);
  const [categoryCursor, setCategoryCursor] = useState("");
  const categories = useResource(
    "/public/catalog/categories?limit=100" +
      (categoryCursor ? `&cursor=${categoryCursor}` : ""),
    parseCategories,
  );
  const productUrl =
    "/public/catalog/products?limit=12" + filters + (cursor ? "&cursor=" + cursor : "");
  const products = useResource(productUrl, parseProducts, initial?.data, {
    initialError: initial?.error,
    revalidateOnMount: false,
  });
  function reset() {
    setFilters("");
    setCursor(undefined);
    setHistory([]);
  }
  return (
    <>
      <noscript>
        <p className="notice">
          Enable JavaScript to filter, load more results or refresh this list. You can
          still follow links on this page.
        </p>
      </noscript>
      <form
        className="catalogue-filters"
        onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          const params = new URLSearchParams();
          for (const [key, value] of values)
            if (typeof value === "string" && value.trim()) params.set(key, value.trim());
          setFilters(`&${params}`);
          setCursor(undefined);
          setHistory([]);
        }}
        onReset={reset}
      >
        <div className="field">
          <label htmlFor="parts-search">Search products</label>
          <input
            id="parts-search"
            name="search"
            type="search"
            maxLength={100}
            placeholder="Product name, brand or SKU"
          />
        </div>
        <div className="field">
          <label htmlFor="parts-category">Category</label>
          <select name="categoryId" id="parts-category">
            <option value="">All categories</option>
            {categories.data?.items.map((category) => (
              <option value={category.id} key={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="parts-sort">Sort by</label>
          <select name="sort" id="parts-sort">
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <details className="fitment-filters">
          <summary>Vehicle compatibility filters</summary>
          <div className="form-row">
            <div className="field">
              <label htmlFor="parts-make">Make (optional)</label>
              <input
                id="parts-make"
                name="make"
                maxLength={100}
                placeholder="Vehicle make"
              />
            </div>
            <div className="field">
              <label htmlFor="parts-model">Model (optional)</label>
              <input id="parts-model" name="model" maxLength={100} />
            </div>
            <div className="field">
              <label htmlFor="parts-year">Year (optional)</label>
              <input
                id="parts-year"
                name="year"
                type="number"
                min={1886}
                max={2100}
                inputMode="numeric"
              />
            </div>
            <div className="field">
              <label htmlFor="parts-brand">Brand (optional)</label>
              <input id="parts-brand" name="brand" maxLength={100} />
            </div>
          </div>
        </details>
        <div className="actions">
          <button type="submit" className="button">
            Search products
          </button>
          <button type="reset" className="button secondary">
            Reset filters
          </button>
        </div>
      </form>
      {categories.error && (
        <>
          <Feedback
            message="Categories could not be loaded. You can still search by name."
            tone="info"
          />
          <button className="text-link" onClick={categories.refresh}>
            Retry categories
          </button>
        </>
      )}
      {categories.data?.nextCursor && (
        <button
          className="button secondary"
          onClick={() => setCategoryCursor(categories.data?.nextCursor ?? "")}
        >
          More categories
        </button>
      )}
      {products.error && (
        <>
          <Feedback message={products.error} />
          <button className="button secondary" onClick={products.refresh}>
            Retry products
          </button>
        </>
      )}
      {products.loading && (
        <output>{products.data ? "Updating results…" : "Loading products…"}</output>
      )}
      <div className="record-grid" aria-busy={products.loading}>
        {(!products.error ? products.data : undefined)?.items.map((product) => (
          <article className="product-card" key={product.id}>
            <Link href={`/parts/${product.id}`}>
              <PublicMedia
                src={
                  (product.images.find((image) => image.isPrimary) ?? product.images[0])
                    ?.url
                }
                alt={product.name}
              />
              <div className="product-copy">
                <span className="muted">{product.category.name}</span>
                <h2>{product.name}</h2>
                <p>{product.brand ?? product.sku}</p>
                <strong>{formatKobo(product.priceKobo)}</strong>
                <p className="stock-label">
                  {product.availability.some((item) => item.inStock)
                    ? "Available at a listed branch"
                    : "Currently unavailable"}
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>
      {!products.loading && !products.error && products.data?.items.length === 0 && (
        <div className="empty">
          <h2>{filters ? "No matching products" : "No products are listed yet"}</h2>
          <p>
            {filters
              ? "Try a different search or reset your filters."
              : "Contact our team to ask about the product you need."}
          </p>
          <Link className="text-link" href="/contact">
            Ask about a product →
          </Link>
        </div>
      )}
      <nav className="pagination" aria-label="Shop pages">
        <button
          className="button secondary"
          disabled={!history.length || products.loading || !!products.error}
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
          disabled={!products.data?.nextCursor || products.loading || !!products.error}
          onClick={() => {
            setHistory((value) => [...value, cursor]);
            setCursor(products.data?.nextCursor);
          }}
        >
          Next
        </button>
      </nav>
    </>
  );
}
