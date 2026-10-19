"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { WorkProductCategory } from "./work-product-category";

export function WorkProductFilters({
  params,
  busy,
  change,
}: {
  params: URLSearchParams;
  busy: boolean;
  change: (params: URLSearchParams) => void;
}) {
  const [category, setCategory] = useState(params.get("categoryId") ?? "");
  return (
    <form
      className="product-filters"
      aria-label="Product filters"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget),
          next = new URLSearchParams();
        for (const key of [
          "search",
          "categoryId",
          "isActive",
          "featured",
          "sort",
          "brand",
          "make",
          "model",
          "year",
        ]) {
          const value = String(data.get(key) ?? "").trim();
          if (value) next.set(key, value);
        }
        change(next);
      }}
    >
      <div className="product-filter-main">
        <div className="field work-service-search">
          <label htmlFor="product-search">Search products</label>
          <div>
            <Search size={16} aria-hidden="true" />
            <input
              id="product-search"
              name="search"
              defaultValue={params.get("search") ?? ""}
              maxLength={100}
              placeholder="Name, SKU, brand or part number"
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="product-category-filter">Category</label>
          <WorkProductCategory
            id="product-category-filter"
            filter
            value={category}
            onChange={setCategory}
          />
        </div>
        <div className="field">
          <label htmlFor="product-visibility">Visibility</label>
          <select
            id="product-visibility"
            name="isActive"
            defaultValue={params.get("isActive") ?? ""}
          >
            <option value="">All visibility</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>
      <div className="product-filter-options">
        <div className="field">
          <label htmlFor="product-featured">Featured</label>
          <select
            id="product-featured"
            name="featured"
            defaultValue={params.get("featured") ?? ""}
          >
            <option value="">All products</option>
            <option value="true">Featured</option>
            <option value="false">Not featured</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="product-sort">Sort</label>
          <select
            id="product-sort"
            name="sort"
            defaultValue={params.get("sort") ?? "newest"}
          >
            <option value="newest">Newest</option>
            <option value="name">Name</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <details
          className="product-more-filters"
          open={["brand", "make", "model", "year"].some((key) => params.has(key))}
        >
          <summary>More filters</summary>
          <div className="product-extra-filters">
            {[
              ["brand", "Brand"],
              ["make", "Vehicle make"],
              ["model", "Vehicle model"],
              ["year", "Year"],
            ].map(([name, label]) => (
              <div className="field" key={name}>
                <label htmlFor={`product-${name}`}>{label}</label>
                <input
                  id={`product-${name}`}
                  name={name}
                  defaultValue={params.get(name) ?? ""}
                  maxLength={name === "year" ? 4 : 100}
                  inputMode={name === "year" ? "numeric" : undefined}
                />
              </div>
            ))}
          </div>
        </details>
        <div className="actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => change(new URLSearchParams())}
          >
            Clear filters
          </button>
          <button className="button" disabled={busy}>
            Apply filters
          </button>
        </div>
      </div>
      {category && (
        <input type="hidden" name="categoryId" value={category} disabled={false} />
      )}
    </form>
  );
}
