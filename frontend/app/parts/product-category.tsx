"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { categorySchema, parseCategories } from "@/lib/api/commerce-schemas";

type Category = ReturnType<typeof parseCategories>["items"][number];
const parseCategory = (value: unknown) => categorySchema.parse(value);

/** Accumulated category pages, separate from the product result pagination. */
export function useProductCategories(selectedId: string) {
  const [cursor, setCursor] = useState("");
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    items: Category[];
    nextCursor?: string;
    loading: boolean;
    error?: string;
  }>({ items: [], loading: true });
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<unknown>(
      `/public/catalog/categories?limit=100${cursor ? `&cursor=${cursor}` : ""}`,
      { signal: controller.signal },
    )
      .then((response) => {
        const page = parseCategories(response.data);
        if (controller.signal.aborted) return;
        setState((previous) => ({
          items: [
            ...new Map(
              [...previous.items, ...page.items].map((item) => [item.id, item]),
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
            loading: false,
            error:
              error instanceof ApiError
                ? error.message
                : "Categories could not be loaded. Please try again.",
          }));
      });
    return () => controller.abort();
  }, [cursor, revision]);
  const selected = state.items.find((item) => item.id === selectedId);
  const detail = useResource(
    selectedId && !selected ? `/public/catalog/categories/${selectedId}` : null,
    parseCategory,
  );
  return {
    ...state,
    selected: selected ?? detail.data,
    selectedError: detail.error,
    retrySelected: detail.refresh,
    retry: () => {
      setState((v) => ({ ...v, loading: true, error: undefined }));
      setRevision((v) => v + 1);
    },
    loadMore: () => {
      if (!state.nextCursor || state.loading) return;
      setState((v) => ({ ...v, loading: true, error: undefined }));
      setCursor(state.nextCursor);
    },
  };
}

export function ProductCategory({
  value,
  categories,
  onChange,
}: {
  value: string;
  categories: ReturnType<typeof useProductCategories>;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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
  const items =
    categories.selected && !categories.items.some((row) => row.id === value)
      ? [categories.selected, ...categories.items]
      : categories.items;
  const options = [{ id: "", name: "All categories" }, ...items].filter((row) =>
    row.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const highlighted = options[Math.min(active, options.length - 1)];
  const label = !value
    ? "All categories"
    : (categories.selected?.name ??
      (categories.selectedError ? "Category unavailable" : "Loading category…"));
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
    if (open && !categories.loading && document.activeElement === document.body)
      input.current?.focus({ preventScroll: true });
  }, [open, categories.loading]);
  useEffect(() => {
    if (open && highlightedId !== undefined)
      document
        .getElementById(`${listId}-${highlightedId || "all"}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedId, listId]);
  return (
    <div className="product-category">
      <label id="product-category-label">Category</label>
      <button
        ref={trigger}
        type="button"
        className="product-category-trigger"
        aria-labelledby="product-category-label product-category-value"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${listId}-popup` : undefined}
        onClick={() => {
          setOpen(!open);
          setQuery("");
          setActive(0);
        }}
      >
        <span id="product-category-value" title={label}>
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
            aria-label="Choose a category"
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
                  document
                    .querySelector<HTMLButtonElement>(".product-filter-trigger")
                    ?.focus();
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
              <label htmlFor={`${listId}-search`}>Search loaded categories</label>
              <button
                className="product-icon-button"
                type="button"
                aria-label="Close category choices"
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
              placeholder="Type a category name"
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
            <p id={`${listId}-hint`}>Search the categories loaded so far.</p>
            <ul id={listId} role="listbox" aria-label="Categories">
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
            {categories.loading && <p role="status">Loading categories…</p>}
            {!categories.loading &&
              !categories.error &&
              (options.length === 0 || (categories.items.length === 0 && !query)) && (
                <p role="status">
                  {query
                    ? "No matching categories in the loaded list."
                    : "No categories are listed yet."}
                </p>
              )}
            {categories.selectedError && (
              <div>
                <p role="status">
                  The selected category could not be read. Retry or choose another
                  category.
                </p>
                <button type="button" onClick={categories.retrySelected}>
                  Retry selected category
                </button>
              </div>
            )}
            {categories.error ? (
              <div>
                <p role="status">{categories.error}</p>
                <button
                  type="button"
                  disabled={categories.loading}
                  onClick={categories.retry}
                >
                  Retry categories
                </button>
              </div>
            ) : (
              categories.nextCursor && (
                <button
                  type="button"
                  disabled={categories.loading}
                  onClick={categories.loadMore}
                >
                  Load more categories
                </button>
              )
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
