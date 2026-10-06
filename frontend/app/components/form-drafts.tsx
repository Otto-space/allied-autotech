"use client";

import { useEffect } from "react";
import {
  beginDraftSubmission,
  cancelDraftSubmission,
  DRAFT_IDENTITY_CHANGED,
  DRAFT_SAVED,
  draftIdentity,
  draftKey,
  forgetDraft,
  readDraft,
  writeDraft,
  type DraftFields,
  type DraftValue,
} from "@/lib/forms/drafts";

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
const sensitive =
  /password|passcode|secret|token|credential|recovery|otp|(?:^|[-_])pin(?:$|[-_])|cvv|cvc|card.?number|mfa|verification.?code|authenticator|one.time/i;
function controls(form: HTMLFormElement): [string, Control][] {
  const repeated = new Map<string, number>();
  return Array.from(form.elements).flatMap((element) => {
    if (!(
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ))
      return [];
    if (
      element.closest("[data-no-draft]") ||
      (element instanceof HTMLInputElement &&
        ["password", "file", "hidden", "submit", "button", "reset"].includes(
          element.type,
        )) ||
      ("readOnly" in element && element.readOnly)
    )
      return [];
    const label = Array.from(
      element.labels ?? [],
      (item) => item.textContent?.trim() ?? "",
    ).join(" ");
    const name =
      element.name || element.id || element.getAttribute("aria-label") || label;
    if (
      !name ||
      sensitive.test(`${name} ${element.autocomplete} ${label}`) ||
      name === "code"
    )
      return [];
    const index = repeated.get(name) ?? 0;
    repeated.set(name, index + 1);
    return [[`${name}:${index}`, element] as [string, Control]];
  });
}
function valueOf(control: Control): DraftValue {
  if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type))
    return control.checked;
  if (control instanceof HTMLSelectElement && control.multiple)
    return Array.from(control.selectedOptions, (option) => option.value);
  return control.value;
}
function restore(control: Control, value: DraftValue) {
  if (control instanceof HTMLSelectElement) {
    const values = Array.isArray(value) ? value : [String(value)];
    if (
      values.some(
        (item) => !Array.from(control.options).some((option) => option.value === item),
      )
    )
      return false;
    for (const option of control.options) option.selected = values.includes(option.value);
    control.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    const checkable =
      control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type);
    const prototype =
      control instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : HTMLTextAreaElement.prototype;
    const property = checkable ? "checked" : "value";
    if (
      (checkable && typeof value !== "boolean") ||
      (!checkable && typeof value !== "string")
    )
      return true;
    // Use the native setter so React receives the change and updates controlled
    // fields / React Hook Form state, not just the visible DOM value.
    Object.getOwnPropertyDescriptor(prototype, property)?.set?.call(control, value);
    if (checkable) {
      if (control instanceof HTMLInputElement && control.type === "radio" && !value)
        return true;
      // React normalizes checkbox/radio changes from click events.
      Object.getOwnPropertyDescriptor(prototype, "checked")?.set?.call(control, !value);
      control.click();
    } else {
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
  return true;
}

export function FormDrafts() {
  useEffect(() => {
    const forms = new Map<
      HTMLFormElement,
      { key: string; fields: DraftFields; pending: DraftFields }
    >();
    let restoring = false;
    let submittedForm: HTMLFormElement | null = null;
    function identify(form: HTMLFormElement) {
      const name = form.dataset.draftKey;
      if (!name || form.closest("[data-no-draft]")) return null;
      const privatePage = /^\/(admin|dashboard)(?:\/|$)/.test(location.pathname);
      const owner = draftIdentity();
      if (privatePage && !owner) return null;
      const scope = form.closest<HTMLElement>("[data-draft-scope]")?.dataset.draftScope;
      return draftKey(
        owner ?? "guest",
        location.pathname,
        scope ? `${scope}:${name}` : name,
      );
    }
    function scan() {
      for (const form of forms.keys()) if (!form.isConnected) forms.delete(form);
      for (const form of document.querySelectorAll<HTMLFormElement>(
        "form[data-draft-key]",
      )) {
        const key = identify(form);
        if (!key) continue;
        let state = forms.get(form);
        if (state?.key !== key) {
          const fields = readDraft(key);
          state = { key, fields, pending: { ...fields } };
          forms.set(form, state);
        }
        restoring = true;
        let rowsReady = true;
        for (const button of form.querySelectorAll<HTMLButtonElement>(
          "button[data-draft-add]",
        )) {
          const group = button.dataset.draftAdd!;
          const saved = state.pending[`@rows:${group}`];
          if (
            typeof saved !== "string" ||
            !/^\d{1,3}$/.test(saved) ||
            Number(saved) > 100
          )
            continue;
          const rows = Array.from(
            form.querySelectorAll<HTMLElement>("[data-draft-row]"),
          ).filter((row) => row.dataset.draftRow === group);
          if (rows.length === Number(saved)) {
            delete state.pending[`@rows:${group}`];
            continue;
          }
          rowsReady = false;
          const action =
            rows.length < Number(saved)
              ? button
              : rows
                  .at(-1)
                  ?.querySelector<HTMLButtonElement>("button[data-draft-remove]");
          if (action && !action.matches(":disabled")) action.click();
        }
        if (!rowsReady) {
          restoring = false;
          continue;
        }
        for (const [name, control] of controls(form)) {
          if (
            Object.hasOwn(state.pending, name) &&
            !control.matches(":disabled") &&
            restore(control, state.pending[name])
          )
            delete state.pending[name];
        }
        restoring = false;
      }
    }
    function changed(event: Event) {
      if (restoring || !(event.target instanceof HTMLElement)) return;
      const form = event.target.closest("form");
      if (!form) return;
      const key = identify(form);
      if (!key) return;
      let state = forms.get(form);
      if (state?.key !== key) {
        state = { key, fields: readDraft(key), pending: {} };
        forms.set(form, state);
      }
      for (const [name, control] of controls(form)) {
        const radioGroup =
          event.target instanceof HTMLInputElement &&
          event.target.type === "radio" &&
          control instanceof HTMLInputElement &&
          control.type === "radio" &&
          control.name === event.target.name;
        if (
          control !== event.target &&
          !radioGroup &&
          !control.hasAttribute("data-draft-context")
        )
          continue;
        const value = valueOf(control);
        if (
          typeof value === "string" &&
          /[?&](?:x-amz-|x-goog-|token=|signature=)/i.test(value)
        )
          continue;
        state.fields[name] = value;
        delete state.pending[name];
      }
      writeDraft(key, state.fields);
    }
    function submit(event: Event) {
      if (!(event.target instanceof HTMLFormElement)) return;
      submittedForm = event.target;
      const key = identify(event.target);
      if (key) beginDraftSubmission(key);
    }
    function pointer(event: Event) {
      if (!(event.target instanceof Element) || restoring) return;
      if (
        !submittedForm?.contains(event.target) &&
        !event.target.closest("dialog[open]")
      ) {
        submittedForm = null;
        cancelDraftSubmission();
      }
    }
    function reset(event: Event) {
      if (!(event.target instanceof HTMLFormElement)) return;
      const state = forms.get(event.target);
      if (state) {
        forgetDraft(state.key);
        state.fields = {};
        state.pending = {};
      }
    }
    function structureChanged(event: Event) {
      if (restoring || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>(
        "button[data-draft-add], button[data-draft-remove]",
      );
      const form = button?.form;
      if (!button || !form) return;
      const group = button.dataset.draftAdd ?? button.dataset.draftRemove!;
      queueMicrotask(() => {
        const state = forms.get(form);
        if (!state) return;
        const count = Array.from(
          form.querySelectorAll<HTMLElement>("[data-draft-row]"),
        ).filter((row) => row.dataset.draftRow === group).length;
        for (const name of Object.keys(state.fields))
          if (name.startsWith(`${group}.`)) delete state.fields[name];
        for (const [name, control] of controls(form))
          if (name.startsWith(`${group}.`)) state.fields[name] = valueOf(control);
        state.fields[`@rows:${group}`] = String(count);
        delete state.pending[`@rows:${group}`];
        writeDraft(state.key, state.fields);
      });
    }
    function saved(event: Event) {
      if (!(event instanceof CustomEvent)) return;
      for (const state of forms.values())
        if (state.key === event.detail) {
          state.fields = {};
          state.pending = {};
        }
    }
    function identityChanged() {
      forms.clear();
      scan();
    }
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-draft-key", "disabled"],
    });
    document.addEventListener("input", changed);
    document.addEventListener("change", changed);
    document.addEventListener("submit", submit, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("reset", reset);
    document.addEventListener("click", structureChanged);
    window.addEventListener(DRAFT_IDENTITY_CHANGED, identityChanged);
    window.addEventListener(DRAFT_SAVED, saved);
    scan();
    return () => {
      observer.disconnect();
      document.removeEventListener("input", changed);
      document.removeEventListener("change", changed);
      document.removeEventListener("submit", submit, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("reset", reset);
      document.removeEventListener("click", structureChanged);
      window.removeEventListener(DRAFT_IDENTITY_CHANGED, identityChanged);
      window.removeEventListener(DRAFT_SAVED, saved);
    };
  }, []);
  return null;
}
