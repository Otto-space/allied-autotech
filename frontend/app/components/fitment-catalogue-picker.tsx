"use client";

import "./fitment-catalogue-picker.css";

import { useEffect, useId, useRef, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import { fitmentOptionsSchema, type FitmentOption } from "@/lib/parts-fitment";

export function FitmentCataloguePicker({
  id,
  kind,
  makeId,
  value,
  selected,
  onChange,
  invalid,
  disabled = false,
}: {
  id: string;
  kind: "make" | "model";
  makeId?: string;
  value: string;
  selected?: FitmentOption;
  onChange: (option?: FitmentOption) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(-1);
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState("");
  const [retry, setRetry] = useState(0);
  const binding = `${kind}:${makeId ?? ""}:${search}`;
  const [state, setState] = useState<{
    binding: string;
    items: FitmentOption[];
    nextCursor?: string;
    loading: boolean;
    error?: string;
  }>({ binding, items: [], loading: true });
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(editing ? text.trim() : "");
      setCursor("");
      setActive(-1);
    }, 200);
    return () => clearTimeout(timer);
  }, [text, editing, makeId]);
  useEffect(() => {
    if (!open || disabled || (kind === "model" && !makeId)) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "30" });
    if (kind === "model") params.set("makeId", makeId!);
    if (search) params.set("search", search);
    if (cursor) params.set("cursor", cursor);
    queueMicrotask(() => {
      if (!controller.signal.aborted)
        setState((previous) => ({ ...previous, loading: true, error: undefined }));
    });
    void apiRequest<unknown>(
      `/public/fitment/${kind === "make" ? "makes" : "models"}?${params}`,
      { signal: controller.signal },
    )
      .then((response) => {
        const page = fitmentOptionsSchema.parse(response.data);
        if (kind === "model" && page.items.some((option) => option.makeId !== makeId))
          throw Error("Invalid model options");
        if (!controller.signal.aborted)
          setState((previous) => ({
            binding,
            items: [
              ...new Map(
                [
                  ...(cursor && previous.binding === binding ? previous.items : []),
                  ...page.items,
                ].map((row) => [row.id, row]),
              ).values(),
            ],
            loading: false,
            nextCursor: page.nextCursor !== cursor ? page.nextCursor : undefined,
          }));
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            binding,
            items: previous.binding === binding ? previous.items : [],
            loading: false,
            error:
              error instanceof ApiError
                ? error.message
                : "Vehicle options could not be loaded.",
          }));
      });
    return () => controller.abort();
  }, [binding, cursor, disabled, kind, makeId, open, retry, search]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const pending = state.binding !== binding || (editing && search !== text.trim());
  const options = pending ? [] : state.items;
  function choose(option: FitmentOption) {
    onChange(option);
    setEditing(false);
    setText("");
    setOpen(false);
    setActive(-1);
    input.current?.focus();
  }
  return (
    <div
      className="fitment-picker"
      ref={wrapper}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <input
        id={id}
        ref={input}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          active >= 0 && options[active] ? `${listId}-${options[active].id}` : undefined
        }
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-hint`}
        autoComplete="off"
        disabled={disabled}
        maxLength={100}
        value={
          editing ? text : (selected?.name ?? (value ? "Loading selected vehicle…" : ""))
        }
        placeholder={
          kind === "make"
            ? "Choose or search a make"
            : makeId
              ? "Choose or search a model"
              : "Choose a make first"
        }
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setEditing(true);
          setText(event.target.value);
          onChange(undefined);
          setOpen(true);
          setCursor("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((old) =>
              options.length
                ? (old + (event.key === "ArrowDown" ? 1 : -1) + options.length) %
                  options.length
                : -1,
            );
          }
          if (event.key === "Enter" && open) {
            event.preventDefault();
            if (active >= 0 && options[active]) choose(options[active]);
          }
        }}
      />
      <small id={`${id}-hint`}>
        {disabled
          ? "Choose a vehicle make first."
          : `Choose a ${kind} from the catalogue suggestions.`}
      </small>
      {open && !disabled && (
        <div className="fitment-picker-popup">
          <div id={listId} role="listbox" aria-label={`Vehicle ${kind} suggestions`}>
            {options.map((option, index) => (
              <div
                role="option"
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") choose(option);
                }}
                key={option.id}
                id={`${listId}-${option.id}`}
                aria-selected={value === option.id}
                data-active={active === index || undefined}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                {option.name}
              </div>
            ))}
          </div>
          {(pending || state.loading) && <p role="status">Loading {kind} options…</p>}
          {!pending && !state.loading && !state.error && !options.length && (
            <p role="status">
              No matching catalogue {kind}. Request help with your vehicle.
            </p>
          )}
          {!pending && state.error && (
            <>
              <p role="alert">{state.error}</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)}>
                Retry {kind} options
              </button>
            </>
          )}
          {!pending && state.nextCursor && (
            <button
              type="button"
              disabled={state.loading}
              onClick={() => setCursor(state.nextCursor!)}
            >
              More {kind} options
            </button>
          )}
        </div>
      )}
    </div>
  );
}
