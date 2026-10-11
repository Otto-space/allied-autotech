"use client";
import { useState } from "react";
import { useResource } from "@/lib/api/use-resource";
import { parseServiceCategories, parseServiceCategory } from "@/lib/api/public-schemas";
import { serviceSorts } from "@/lib/service-discovery";
import { CursorPagination, useCursorPage } from "./cursor-pagination";

export function ServiceDiscoveryControls({
  params,
  change,
}: {
  params: URLSearchParams;
  change: (key: string, value: string) => void;
}) {
  const [categorySearch, setCategorySearch] = useState("");
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "20" });
  if (categorySearch) query.set("search", categorySearch);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const categories = useResource(
    `/public/services/categories?${query}`,
    parseServiceCategories,
  );
  const selected = params.get("categoryId") ?? "";
  const selectedCategory = useResource(
    selected ? `/public/services/categories/${selected}` : null,
    parseServiceCategory,
  );
  return (
    <div className="services-discovery-controls">
      <form
        key={params.get("search") ?? ""}
        onSubmit={(event) => {
          event.preventDefault();
          change(
            "search",
            String(new FormData(event.currentTarget).get("search") ?? "").trim(),
          );
        }}
      >
        <label htmlFor="service-search">Search services</label>
        <div className="services-search-row">
          <input
            id="service-search"
            name="search"
            type="search"
            minLength={2}
            maxLength={100}
            defaultValue={params.get("search") ?? ""}
            placeholder="Name or work needed"
          />
          <button className="button secondary">Search</button>
        </div>
      </form>
      <div>
        <label htmlFor="service-sort">Sort services</label>
        <select
          id="service-sort"
          value={params.get("sort") ?? "name"}
          onChange={(e) => change("sort", e.target.value)}
        >
          {serviceSorts.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="services-category-controls">
        <label htmlFor="service-category">Service category</label>
        <select
          id="service-category"
          value={selected}
          onChange={(e) => change("categoryId", e.target.value)}
        >
          <option value="">All categories</option>
          {selected && !categories.data?.items.some((c) => c.id === selected) && (
            <option value={selected}>
              {selectedCategory.data?.name ?? "Selected category"}
            </option>
          )}
          {categories.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <details>
          <summary>Find a category</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pagination.reset();
              setCategorySearch(
                String(new FormData(e.currentTarget).get("categorySearch") ?? "").trim(),
              );
            }}
          >
            <label htmlFor="service-category-search">Category name</label>
            <div className="services-search-row">
              <input
                id="service-category-search"
                name="categorySearch"
                type="search"
                maxLength={120}
              />
              <button className="button secondary">Find categories</button>
            </div>
          </form>
        </details>
        {categories.loading && <p role="status">Loading categories…</p>}
        {categories.error ? (
          <p role="alert">
            Categories could not be loaded.{" "}
            <button type="button" className="text-link" onClick={categories.refresh}>
              Retry categories
            </button>
          </p>
        ) : !categories.loading && categories.data?.items.length === 0 ? (
          <p>No categories match.</p>
        ) : null}
        {selectedCategory.error && (
          <p role="status">
            The selected category could not be loaded.{" "}
            <button
              type="button"
              className="text-link"
              onClick={selectedCategory.refresh}
            >
              Retry selected category
            </button>
          </p>
        )}
        {(categories.data?.nextCursor || pagination.page > 1) && (
          <CursorPagination
            pagination={pagination}
            nextCursor={categories.data?.nextCursor}
            disabled={categories.loading || !!categories.error}
            label="Service category options"
          />
        )}
      </div>
    </div>
  );
}
