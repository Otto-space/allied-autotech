"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  categorySchema,
  parseCategories,
  parseProductFacets,
} from "@/lib/api/commerce-schemas";

type Category = { id: string; name: string; parentId?: string | null };
type CategoryScope = { rootOnly?: boolean; parentId?: string };
const parseCategory = (value: unknown) => categorySchema.parse(value);
export const useProductCategory = (id: string) =>
  useResource(id ? `/public/catalog/categories/${id}` : null, parseCategory);

/** Search and accumulated option pages are separate from product result pagination. */
export function useProductCategories(
  selectedId: string,
  search = "",
  enabled = true,
  scope: CategoryScope = {},
) {
  const [debounced, setDebounced] = useState(search.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const rootOnly = scope.rootOnly === true,
    parentId = scope.parentId ?? "";
  const hierarchical = rootOnly || !!parentId;
  const readKey = `${rootOnly ? "roots" : parentId ? `parent:${parentId}` : "facets"}:${debounced}`;
  const [position, setPosition] = useState({ search: readKey, cursor: "" });
  if (position.search !== readKey) setPosition({ search: readKey, cursor: "" });
  const cursor = position.search === readKey ? position.cursor : "";
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    search: string;
    items: Category[];
    nextCursor?: string;
    loading: boolean;
    error?: string;
  }>({ search: readKey, items: [], loading: true });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams(
      hierarchical ? { limit: "20" } : { field: "category", limit: "20" },
    );
    if (rootOnly) params.set("rootOnly", "true");
    else if (parentId) params.set("parentId", parentId);
    if (debounced) params.set("search", debounced);
    if (cursor) params.set("cursor", cursor);
    void apiRequest<unknown>(
      `/public/catalog/${hierarchical ? "categories" : "facets"}?${params}`,
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        const page = hierarchical
          ? parseCategories(response.data)
          : (() => {
              const result = parseProductFacets(response.data);
              return {
                ...result,
                items: result.items.map((row) => ({ id: row.value, name: row.label })),
              };
            })();
        const rows: Category[] = page.items;
        if (controller.signal.aborted) return;
        setState((previous) => ({
          search: readKey,
          items: [
            ...new Map(
              [
                ...(cursor && previous.search === readKey ? previous.items : []),
                ...rows,
              ].map((item) => [item.id, item]),
            ).values(),
          ],
          nextCursor: page.nextCursor !== cursor ? page.nextCursor : undefined,
          loading: false,
        }));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            ...previous,
            search: readKey,
            items: previous.search === readKey ? previous.items : [],
            loading: false,
            error:
              error instanceof ApiError
                ? error.message
                : "Categories could not be loaded. Please try again.",
          }));
      });
    return () => controller.abort();
  }, [cursor, debounced, revision, enabled, hierarchical, rootOnly, parentId, readKey]);
  const pending = debounced !== search.trim() || state.search !== readKey;
  const items = pending ? [] : state.items;
  const selected = items.find((item) => item.id === selectedId);
  const detail = useResource(
    selectedId && !selected ? `/public/catalog/categories/${selectedId}` : null,
    parseCategory,
  );
  return {
    items,
    loading: enabled && (pending || state.loading),
    error: pending ? undefined : state.error,
    nextCursor: pending ? undefined : state.nextCursor,
    selected: selected ?? detail.data,
    selectedError: detail.error,
    retrySelected: detail.refresh,
    retry: () => {
      setState((v) => ({ ...v, loading: true, error: undefined }));
      setRevision((v) => v + 1);
    },
    restart: () => {
      setState((v) => ({ ...v, loading: true, error: undefined }));
      setPosition({ search: readKey, cursor: "" });
      setRevision((v) => v + 1);
    },
    loadMore: () => {
      if (!state.nextCursor || state.loading || pending) return;
      setState((v) => ({ ...v, loading: true, error: undefined }));
      setPosition({ search: readKey, cursor: state.nextCursor });
    },
  };
}

export function ProductCategory({
  value,
  categories,
  onChange,
  title = "Category",
  scope = {},
  disabled = false,
}: {
  value: string;
  categories: ReturnType<typeof useProductCategories>;
  onChange: (id: string) => void;
  title?: "Category" | "Subcategory";
  scope?: CategoryScope;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const singular = title.toLowerCase(),
    plural = title === "Subcategory" ? "subcategories" : "categories";
  const suggestions = useProductCategories(value, query, open && !disabled, scope);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [position, setPosition] = useState({
    left: 12,
    top: 0,
    width: 300,
    maxHeight: 360,
    transform: "none",
  });
  const options = [
    ...(!query.trim() ? [{ id: "", name: `All ${plural}` }] : []),
    ...(!query.trim() &&
    categories.selected &&
    !suggestions.items.some((row) => row.id === value)
      ? [categories.selected]
      : []),
    ...suggestions.items,
  ];
  const highlighted = options[Math.min(active, options.length - 1)];
  const label = !value
    ? `All ${plural}`
    : (categories.selected?.name ??
      (categories.selectedError ? `${title} unavailable` : "Loading category…"));
  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  function choose(id: string) {
    onChange(id);
    close(true);
  }
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const height = viewport?.height ?? innerHeight,
        offset = viewport?.offsetTop ?? 0;
      const below = height + offset - rect.bottom - 12,
        above = rect.top - offset - 12;
      const down = below >= 360 || below >= above;
      const compactViewport = Math.max(below, above) < 280;
      const width = Math.min(Math.max(rect.width, 310), innerWidth - 24);
      setPosition({
        left: Math.max(12, Math.min(rect.left, innerWidth - width - 12)),
        top: compactViewport ? offset + 12 : down ? rect.bottom + 5 : rect.top - 5,
        width,
        maxHeight: compactViewport
          ? Math.max(90, height - 24)
          : Math.max(90, Math.min(400, down ? below : above)),
        transform: compactViewport || down ? "none" : "translateY(-100%)",
      });
    };
    reposition();
    input.current?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        !popup.current?.contains(event.target as Node) &&
        !trigger.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    window.visualViewport?.addEventListener("scroll", reposition);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      window.visualViewport?.removeEventListener("scroll", reposition);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);
  const highlightedId = highlighted?.id;
  useEffect(() => {
    // A disabled/replaced Load more button can hand focus back to the document.
    // Keep keyboard navigation in the open picker when the request settles.
    if (open && !suggestions.loading && document.activeElement === document.body)
      input.current?.focus({ preventScroll: true });
  }, [open, suggestions.loading]);
  useEffect(() => {
    if (open && highlightedId !== undefined)
      document
        .getElementById(`${listId}-${highlightedId || "all"}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedId, listId]);
  return (
    <div
      className={`product-category${title === "Subcategory" ? " product-subcategory" : ""}`}
    >
      <label id={`${listId}-label`}>{title}</label>
      <button
        ref={trigger}
        type="button"
        className="product-category-trigger"
        disabled={disabled}
        aria-labelledby={`${listId}-label ${listId}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${listId}-popup` : undefined}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
      >
        <span id={`${listId}-value`} title={label}>
          {label}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            className="product-category-popup"
            id={`${listId}-popup`}
            role="dialog"
            aria-label={`Choose a ${singular}`}
            style={position}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close(true);
              }
              if (event.key === "Tab") {
                const controls = event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled), input:not(:disabled)",
                );
                if (event.shiftKey && document.activeElement === controls[0]) {
                  event.preventDefault();
                  close(true);
                } else if (
                  !event.shiftKey &&
                  document.activeElement === controls[controls.length - 1]
                ) {
                  event.preventDefault();
                  close();
                  const next =
                    title === "Category"
                      ? document.querySelector<HTMLButtonElement>(
                          ".product-subcategory .product-category-trigger:not(:disabled)",
                        )
                      : null;
                  (
                    next ??
                    document.querySelector<HTMLButtonElement>(".product-filter-trigger")
                  )?.focus();
                }
              }
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                !event.currentTarget.contains(event.relatedTarget) &&
                event.relatedTarget !== trigger.current
              )
                close();
            }}
          >
            <div className="product-category-search">
              <label htmlFor={`${listId}-search`}>Search {plural}</label>
              <button
                className="product-icon-button"
                type="button"
                aria-label={`Close ${singular} choices`}
                onClick={() => close(true)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <input
              ref={input}
              id={`${listId}-search`}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                highlighted ? `${listId}-${highlighted.id || "all"}` : undefined
              }
              aria-describedby={`${listId}-hint`}
              autoComplete="off"
              maxLength={120}
              value={query}
              placeholder={`Type a ${singular} name`}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  setActive((index) =>
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? Math.max(0, options.length - 1)
                        : Math.max(
                            0,
                            Math.min(
                              options.length - 1,
                              index + (event.key === "ArrowDown" ? 1 : -1),
                            ),
                          ),
                  );
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  if (highlighted) choose(highlighted.id);
                }
              }}
            />
            <p id={`${listId}-hint`}>
              Search published {plural} by the start of their name.
            </p>
            <ul
              id={listId}
              role="listbox"
              aria-label={title === "Subcategory" ? "Subcategories" : "Categories"}
            >
              {options.map((row) => (
                <li
                  key={row.id}
                  id={`${listId}-${row.id || "all"}`}
                  role="option"
                  aria-selected={row.id === value}
                  className={row.id === highlighted?.id ? "is-active" : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(row.id)}
                >
                  <span>{row.name}</span>
                  {row.id === value && <Check size={16} aria-hidden="true" />}
                </li>
              ))}
            </ul>
            {suggestions.loading && <p role="status">Loading categories…</p>}
            {!suggestions.loading &&
              !suggestions.error &&
              (options.length === 0 || (suggestions.items.length === 0 && !query)) && (
                <p role="status">
                  {query ? `No matching ${plural}.` : `No ${plural} are listed yet.`}
                </p>
              )}
            {categories.selectedError && (
              <div>
                <p role="status">{`The selected ${singular} could not be read. Retry or choose another ${singular}.`}</p>
                <button type="button" onClick={categories.retrySelected}>
                  Retry selected {singular}
                </button>
              </div>
            )}
            {suggestions.error ? (
              <div>
                <p role="status">{suggestions.error}</p>
                <button
                  type="button"
                  disabled={suggestions.loading}
                  onClick={suggestions.retry}
                >
                  Retry {plural}
                </button>
                <button type="button" onClick={suggestions.restart}>
                  Start {plural} over
                </button>
              </div>
            ) : (
              suggestions.nextCursor && (
                <button
                  type="button"
                  disabled={suggestions.loading}
                  onClick={suggestions.loadMore}
                >
                  Load more {plural}
                </button>
              )
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
