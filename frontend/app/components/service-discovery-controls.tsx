"use client";
import { useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
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
  const [categoryDraft, setCategoryDraft] = useState("");
  const [longList, setLongList] = useState(false);
  const categoryInput = useRef<HTMLInputElement>(null);
  const pagination = useCursorPage();
  const query = new URLSearchParams({ limit: "20" });
  if (categorySearch) query.set("search", categorySearch);
  if (pagination.cursor) query.set("cursor", pagination.cursor);
  const categories = useResource(
    `/public/services/categories?${query}`,
    parseServiceCategories,
  );
  const selected = params.get("categoryId") ?? "";
  if (categories.data?.nextCursor && !longList) setLongList(true);
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
      {!longList && (
        <div className="services-category-controls">
          <label htmlFor="service-category">Service category</label>
          <select
            id="service-category"
            disabled={categories.loading && !categories.data}
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
          {categories.loading && !categories.data && (
            <p role="status">Loading categories…</p>
          )}
          {categories.error && (
            <p role="alert">
              Categories could not be loaded.{" "}
              <button type="button" className="text-link" onClick={categories.refresh}>
                Retry categories
              </button>
            </p>
          )}
          {!categories.loading &&
            !categories.error &&
            categories.data?.items.length === 0 && (
              <p role="status">No service categories are available yet.</p>
            )}
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
        </div>
      )}
      {longList && (
        <details className="services-category-finder">
          <summary>
            <Search size={17} aria-hidden="true" />
            <span>Find a category</span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="services-category-finder__body">
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
            {selected && (
              <p>
                Selected: {selectedCategory.data?.name ?? "Selected category"}.{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => change("categoryId", "")}
                >
                  All categories
                </button>
              </p>
            )}
            <p className="services-category-finder__hint">
              Search by name, then choose a category below.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                pagination.reset();
                setCategorySearch(categoryDraft.trim());
              }}
            >
              <label htmlFor="service-category-search">Category name</label>
              <div className="services-search-row">
                <input
                  ref={categoryInput}
                  id="service-category-search"
                  name="categorySearch"
                  type="search"
                  maxLength={120}
                  value={categoryDraft}
                  onChange={(event) => setCategoryDraft(event.target.value)}
                  placeholder="Try diagnostics or maintenance"
                  aria-controls="service-category-results"
                />
                <button
                  className="button secondary"
                  disabled={categories.loading}
                  type="submit"
                >
                  Find categories
                </button>
              </div>
            </form>
            <div
              id="service-category-results"
              className="services-category-results"
              aria-busy={categories.loading}
            >
              <p className="services-category-status" role="status">
                {categories.loading
                  ? "Loading categories…"
                  : !categories.error && categories.data?.items.length
                    ? `${categories.data.items.length} ${categories.data.items.length === 1 ? "category" : "categories"}${categorySearch ? ` matching “${categorySearch}”` : " available on this page"}.`
                    : ""}
              </p>
              {categories.error ? (
                <p role="alert">
                  Categories could not be loaded.{" "}
                  <button
                    type="button"
                    className="text-link"
                    onClick={categories.refresh}
                  >
                    Retry categories
                  </button>
                </p>
              ) : !categories.loading && categories.data?.items.length === 0 ? (
                <p className="services-category-empty" role="status">
                  {categorySearch
                    ? "No categories match. Try a different name or clear your search."
                    : "No service categories are available yet."}
                </p>
              ) : null}
              {!categories.error &&
                !categories.loading &&
                !!categories.data?.items.length && (
                  <ul
                    className="services-category-options"
                    aria-label="Matching service categories"
                  >
                    {categories.data.items.map((category) => (
                      <li key={category.id}>
                        <button
                          type="button"
                          aria-pressed={selected === category.id}
                          onClick={() => change("categoryId", category.id)}
                        >
                          <span>{category.name}</span>
                          {selected === category.id && (
                            <Check size={16} aria-hidden="true" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              {categorySearch && (
                <button
                  type="button"
                  className="text-link services-category-reset"
                  onClick={() => {
                    pagination.reset();
                    setCategoryDraft("");
                    setCategorySearch("");
                    categoryInput.current?.focus();
                  }}
                >
                  Clear category search
                </button>
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
        </details>
      )}
    </div>
  );
}
