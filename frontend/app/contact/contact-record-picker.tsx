"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { z } from "zod";
import { useResource } from "@/lib/api/use-resource";
import {
  parseSupportSources,
  supportSourcePaths,
  type SupportSource,
  type SupportSourceType,
} from "@/lib/api/support-sources";
import { CursorPagination, useCursorPage } from "../components/cursor-pagination";

const branchPage = z.object({
  items: z.array(z.object({ id: z.uuid(), name: z.string() })),
  nextCursor: z.uuid().optional(),
});

/** Contact-only searchable choice. Search is explicitly limited to the current API page. */
export function ContactRecordPicker({
  id,
  kind,
  value,
  onChange,
  error,
  required = true,
}: {
  id: string;
  kind: "branch" | SupportSourceType;
  value?: SupportSource;
  onChange: (value?: SupportSource) => void;
  error?: string;
  required?: boolean;
}) {
  const pagination = useCursorPage();
  const parse = useCallback(
    (data: unknown) => {
      if (kind !== "branch") return parseSupportSources(kind, data);
      const page = branchPage.parse(data);
      return {
        ...page,
        items: page.items.map((row) => ({
          id: row.id,
          label: row.name,
          fields: { branchId: row.id },
          inheritsBranch: false,
        })),
      };
    },
    [kind],
  );
  const path = kind === "branch" ? "/public/branches" : supportSourcePaths[kind];
  const records = useResource(
    `${path}?limit=20${pagination.cursor ? `&cursor=${pagination.cursor}` : ""}`,
    parse,
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 280,
    maxHeight: 240,
    transform: "none",
  });
  const input = useRef<HTMLInputElement>(null);
  const draftSelection = useRef<HTMLSelectElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const listId = useId();
  const options = (records.data?.items ?? []).filter((row) =>
    row.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const highlighted = options[active];
  const disabled = records.loading || !!records.error;
  const onlyBranch =
    kind === "branch" &&
    !disabled &&
    !records.refreshError &&
    !pagination.cursor &&
    !records.data?.nextCursor &&
    records.data?.items.length === 1 &&
    (!value || value.id === records.data.items[0].id)
      ? records.data.items[0]
      : undefined;
  useEffect(() => {
    if (onlyBranch && !value) onChange(onlyBranch);
  }, [onlyBranch, value, onChange]);
  const expanded = open && !disabled;
  const choose = (row: SupportSource) => {
    onChange(row);
    if (draftSelection.current) {
      draftSelection.current.value = row.id;
      draftSelection.current.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setOpen(false);
    setQuery("");
    input.current?.focus();
  };
  useLayoutEffect(() => {
    if (!expanded) return;
    const reposition = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const height = viewport?.height ?? innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      const below = height + offset - rect.bottom - 12;
      const above = rect.top - offset - 12;
      const down = below >= 190 || below >= above;
      const maxHeight = Math.max(80, Math.min(260, down ? below : above));
      setPosition({
        left: Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12)),
        top: down ? rect.bottom + 5 : rect.top - 5,
        width: Math.min(rect.width, innerWidth - 24),
        maxHeight,
        transform: down ? "none" : "translateY(-100%)",
      });
    };
    reposition();
    const dismiss = (event: PointerEvent) => {
      if (
        !input.current?.contains(event.target as Node) &&
        !popup.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    addEventListener("resize", reposition);
    addEventListener("scroll", reposition, true);
    window.visualViewport?.addEventListener("resize", reposition);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      removeEventListener("resize", reposition);
      removeEventListener("scroll", reposition, true);
      window.visualViewport?.removeEventListener("resize", reposition);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [expanded]);
  useEffect(() => {
    if (expanded && highlighted)
      document
        .getElementById(`${listId}-${highlighted.id}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [expanded, highlighted, listId]);
  return (
    <>
      <select
        hidden
        aria-hidden="true"
        tabIndex={-1}
        ref={draftSelection}
        name={`${id}:${kind}:selection`}
        value={value?.id ?? ""}
        disabled={disabled}
        onChange={(event) => {
          const selected = records.data?.items.find(
            (row) => row.id === event.target.value,
          );
          if (selected) onChange(selected);
        }}
      >
        <option value="" />
        {value && !records.data?.items.some((row) => row.id === value.id) && (
          <option value={value.id}>{value.label}</option>
        )}
        {records.data?.items.map((row) => (
          <option key={row.id} value={row.id}>
            {row.label}
          </option>
        ))}
      </select>
      <div className="contact-choice">
        {onlyBranch ? (
          <output id={id} className="contact-fixed-choice">
            {onlyBranch.label}
          </output>
        ) : (
          <>
            <input
              data-no-draft
              ref={input}
              id={id}
              role="combobox"
              aria-required={required}
              aria-expanded={expanded}
              aria-controls={expanded ? listId : undefined}
              aria-autocomplete="list"
              aria-activedescendant={
                expanded && highlighted ? `${listId}-${highlighted.id}` : undefined
              }
              aria-invalid={!!error}
              aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
              autoComplete="off"
              disabled={disabled}
              placeholder={
                records.loading
                  ? "Loading choices…"
                  : kind === "branch"
                    ? "Choose a branch"
                    : "Choose a related record"
              }
              value={expanded ? query : (value?.label ?? "")}
              onFocus={() => {
                // Focus can scroll an input clear of the support controls before the
                // pointer is released. Open here so that movement cannot lose the click.
                setOpen(true);
                setQuery("");
                setActive(0);
              }}
              onClick={() => {
                setOpen(true);
                setQuery("");
                setActive(0);
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
                setOpen(true);
              }}
              onBlur={(event) => {
                if (!popup.current?.contains(event.relatedTarget)) setOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  return;
                }
                if (event.key === "Tab") {
                  setOpen(false);
                  return;
                }
                if (["ArrowDown", "ArrowUp"].includes(event.key)) {
                  event.preventDefault();
                  setOpen(true);
                  setActive((index) =>
                    expanded
                      ? Math.max(
                          0,
                          Math.min(
                            options.length - 1,
                            index + (event.key === "ArrowDown" ? 1 : -1),
                          ),
                        )
                      : 0,
                  );
                }
                if (expanded && (event.key === "Home" || event.key === "End")) {
                  event.preventDefault();
                  setActive(event.key === "Home" ? 0 : Math.max(0, options.length - 1));
                }
                if (expanded && event.key === "Enter") {
                  event.preventDefault();
                  if (highlighted) choose(highlighted);
                }
              }}
            />
            {expanded ? (
              <Search aria-hidden="true" size={16} />
            ) : (
              <ChevronDown aria-hidden="true" size={16} />
            )}
          </>
        )}
      </div>
      {!onlyBranch && (
        <p className="contact-field-help" id={`${id}-help`}>
          {records.loading
            ? "Loading choices…"
            : records.error
              ? "Choices could not be loaded. Please retry."
              : "Type to find a choice on this page."}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
      {records.error && (
        <button type="button" className="text-link" onClick={records.refresh}>
          Retry {kind === "branch" ? "branch choices" : "related records"}
        </button>
      )}
      {!records.loading && !records.error && records.data?.items.length === 0 && (
        <p role="status">
          No {kind === "branch" ? "branches" : "related records"} available on this page.
        </p>
      )}
      {(records.data?.nextCursor || pagination.page > 1) && (
        <CursorPagination
          pagination={pagination}
          nextCursor={records.data?.nextCursor}
          disabled={disabled}
          label={`${kind === "branch" ? "branch choices" : "Related records"}`}
        />
      )}
      {expanded &&
        createPortal(
          <div ref={popup} className="contact-choice-popover" style={position}>
            <ul
              id={listId}
              role="listbox"
              aria-label={kind === "branch" ? "Branches" : "Related records"}
            >
              {options.map((row, index) => (
                <li
                  key={row.id}
                  id={`${listId}-${row.id}`}
                  role="option"
                  aria-selected={row.id === value?.id}
                  className={index === active ? "is-active" : undefined}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => choose(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") choose(row);
                  }}
                  onPointerMove={() => setActive(index)}
                >
                  {row.label}
                  {row.id === value?.id && <Check size={16} aria-hidden="true" />}
                </li>
              ))}
            </ul>
            {options.length === 0 && (
              <p role="status">No matching choices on this page.</p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
