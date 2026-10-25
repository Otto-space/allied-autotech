import { z } from "zod";
import {
  catalogueEnquiryContext,
  type CatalogueEnquiryContext,
} from "../catalogue-enquiry";
import { draftKey, readDraft } from "./drafts";

export const CATALOGUE_DRAFT_PREFIX = "aat:catalogue-drafts:v1:";
const contextSchema = z.object({
  id: z.string().max(10000),
  href: z.string().max(10000),
  label: z.string().max(160),
  contextKey: z.string().max(10000).optional(),
});
const stateSchema = z.object({
  version: z.literal(1),
  active: z.string().max(10000),
  contexts: z.array(contextSchema).max(32),
  decisions: z
    .array(z.object({ incoming: z.string().max(10000), selected: z.string().max(10000) }))
    .max(32),
});
export type EnquiryDraftState = z.infer<typeof stateSchema>;
export function enquiryFormId(context: CatalogueEnquiryContext) {
  return JSON.stringify(
    context.contextKey
      ? ["support-create-form:parts:1", context.contextKey, "enquiries"]
      : ["support-create-form:1", null, "enquiries"],
  );
}
export function enquiryDraftKey(owner: string, context: CatalogueEnquiryContext) {
  return draftKey(owner, "/contact", enquiryFormId(context));
}
export function hasEnquiryDraft(owner: string, context: CatalogueEnquiryContext) {
  return Object.values(readDraft(enquiryDraftKey(owner, context))).some((value) =>
    typeof value === "string"
      ? !!value.trim()
      : Array.isArray(value)
        ? value.length > 0
        : value,
  );
}
export function saveEnquiryDraftState(owner: string, state: EnquiryDraftState) {
  try {
    sessionStorage.setItem(
      `${CATALOGUE_DRAFT_PREFIX}${owner}`,
      JSON.stringify(stateSchema.parse(state)),
    );
    return true;
  } catch {
    return false;
  }
}
function safeContext(value: CatalogueEnquiryContext) {
  try {
    const url = new URL(value.href, "https://catalogue.invalid");
    if (url.origin !== "https://catalogue.invalid" || url.pathname !== "/contact")
      return null;
    const context = catalogueEnquiryContext(url.searchParams);
    if (context.id !== value.id) return null;
    return { ...context, ...(value.contextKey ? { contextKey: value.contextKey } : {}) };
  } catch {
    return null;
  }
}
function load(owner: string): EnquiryDraftState {
  let state: EnquiryDraftState = { version: 1, active: "", contexts: [], decisions: [] };
  try {
    const raw = sessionStorage.getItem(`${CATALOGUE_DRAFT_PREFIX}${owner}`);
    if (raw && raw.length <= 400000) {
      const parsed = stateSchema.safeParse(JSON.parse(raw));
      if (parsed.success)
        state = {
          ...parsed.data,
          contexts: parsed.data.contexts.flatMap((c) => safeContext(c) ?? []),
        };
    }
    // Recover the established generic/parts draft keys, including drafts predating
    // this registry. No contact fields or private context are moved between owners.
    const prefix = "aat:form-draft:v1:";
    for (const key of Object.keys(sessionStorage)) {
      if (!key.startsWith(prefix)) continue;
      try {
        const [principal, route, form] = JSON.parse(
          key.slice(prefix.length),
        ) as unknown[];
        if (principal !== owner || route !== "/contact" || typeof form !== "string")
          continue;
        const parts: unknown = JSON.parse(form);
        if (!Array.isArray(parts)) continue;
        let context: CatalogueEnquiryContext | null = null;
        if (
          parts[0] === "support-create-form:1" &&
          parts[1] === null &&
          parts[2] === "enquiries"
        )
          context = catalogueEnquiryContext(new URLSearchParams());
        else if (
          parts[0] === "support-create-form:parts:1" &&
          typeof parts[1] === "string" &&
          parts[1].length <= 10000 &&
          parts[2] === "enquiries"
        )
          context = {
            ...catalogueEnquiryContext(new URLSearchParams(parts[1])),
            contextKey: parts[1],
          };
        if (
          context &&
          hasEnquiryDraft(owner, context) &&
          !state.contexts.some((c) => c.id === context!.id) &&
          state.contexts.length < 31
        )
          state.contexts.push(context);
      } catch {
        /* Unrelated or malformed local state grants no access. */
      }
    }
  } catch {
    /* Continue with the current page when optional storage is unavailable. */
  }
  return state;
}

export function prepareEnquiryContext(owner: string, incoming: CatalogueEnquiryContext) {
  const state = load(owner);
  let requested = state.contexts.find((c) => c.id === incoming.id);
  if (!requested) {
    requested = incoming;
    state.contexts.push(requested);
  }
  // Metadata is bounded; existing form drafts themselves are never deleted here.
  if (state.contexts.length > 32)
    state.contexts = [...state.contexts.slice(-31), requested];
  let active = state.contexts.find(
    (c) => c.id === state.active && hasEnquiryDraft(owner, c),
  );
  if (!active)
    active = state.contexts.find(
      (c) => c.id !== requested.id && hasEnquiryDraft(owner, c),
    );
  const decision = state.decisions.find((d) => d.incoming === requested.id);
  const resolved = decision && state.contexts.find((c) => c.id === decision.selected);
  if (resolved && (resolved.id === requested.id || hasEnquiryDraft(owner, resolved))) {
    state.active = resolved.id;
    return { state, incoming: requested, selected: resolved, conflict: false };
  }
  if (active && active.id !== requested.id)
    return { state, incoming: requested, selected: active, conflict: true };
  state.active = requested.id;
  return { state, incoming: requested, selected: requested, conflict: false };
}
export function chooseEnquiryContext(
  state: EnquiryDraftState,
  incoming: string,
  selected: string,
): EnquiryDraftState {
  if (!state.contexts.some((c) => c.id === selected)) return state;
  return {
    ...state,
    active: selected,
    decisions: [
      ...state.decisions.filter((d) => d.incoming !== incoming),
      { incoming, selected },
    ].slice(-32),
  };
}
