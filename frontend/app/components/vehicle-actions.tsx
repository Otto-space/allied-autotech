"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, Heart, MessageCircle, Phone } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { business } from "@/lib/business";
import { inspectionInstant } from "@/lib/vehicle-detail";
import { AccountChangeNotice } from "./account-change-notice";

const identity = z.object({
  user: z.object({ role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]) }),
});
const receipt = z.object({ id: z.uuid() });
type Action = "save" | "enquire" | "inspect";
type Result = { action: Action; success: boolean; message: string; login?: boolean };

export function VehicleActions({
  listingId,
  gallery,
  summary,
  children,
}: {
  listingId: string;
  gallery: ReactNode;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [result, setResult] = useState<Result>();
  const [active, setActive] = useState<Action>();
  const [saved, setSaved] = useState(false);
  const [enquired, setEnquired] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [dateError, setDateError] = useState<string>();
  const [notesError, setNotesError] = useState<string>();
  const [notesLength, setNotesLength] = useState(0);
  const inspectionForm = useRef<HTMLFormElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const accountNotice = useRef<HTMLDivElement>(null);
  const inspectionHeading = useRef<HTMLHeadingElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const discard = useCallback(() => {
    setResult(undefined);
    setActive(undefined);
    setSaved(false);
    setEnquired(false);
    setInspected(false);
    setDateError(undefined);
    setNotesError(undefined);
    setNotesLength(0);
    inspectionForm.current?.reset();
  }, []);
  const operation = useAccountMutation(discard);
  const { busy } = operation;
  const loginHref = `/login?next=${encodeURIComponent(`/vehicles/${listingId}`)}`;
  function focus(element: HTMLElement | null) {
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  useEffect(() => {
    if (result) focus(resultHeading.current);
  }, [result]);
  useEffect(() => {
    if (operation.sessionChanged) focus(accountNotice.current);
  }, [operation.sessionChanged]);

  async function submit(action: Action, form?: FormData) {
    if (busy) return;
    const preferred =
      action === "inspect"
        ? inspectionInstant(String(form?.get("preferredStartAt") ?? ""))
        : undefined;
    if (action === "inspect" && !preferred) {
      setDateError("Choose a future date and time in Lagos time.");
      setResult(undefined);
      focus(dateInput.current);
      return;
    }
    const controller = operation.begin();
    if (!controller) return;
    setResult(undefined);
    setDateError(undefined);
    setNotesError(undefined);
    setActive(action);
    let mutationStarted = false;
    try {
      const session = identity.parse(
        (
          await apiRequest("/auth/session", {
            signal: controller.signal,
            optionalSession: true,
          })
        ).data,
      );
      if (session.user.role !== "CUSTOMER") {
        setResult({
          action,
          success: false,
          message:
            "These requests are available to customer accounts. Contact our team for help.",
        });
        return;
      }
      if (action === "save") {
        mutationStarted = true;
        await apiRequest(`/customers/saved-vehicles/${listingId}`, {
          method: "PUT",
          csrf: true,
          signal: controller.signal,
          body: {},
        });
      } else if (action === "enquire") {
        const body: RequestBody<"/customers/vehicle-transactions", "post"> = {
          vehicleListingId: listingId,
        };
        mutationStarted = true;
        receipt.parse(
          (
            await apiRequest("/customers/vehicle-transactions", {
              method: "POST",
              csrf: true,
              signal: controller.signal,
              body,
            })
          ).data,
        );
      } else {
        const notes = String(form?.get("notes") ?? "").trim();
        const body: RequestBody<"/customers/vehicle-inspections", "post"> = {
          vehicleListingId: listingId,
          preferredStartAt: preferred!,
          ...(notes ? { notes } : {}),
        };
        mutationStarted = true;
        receipt.parse(
          (
            await apiRequest("/customers/vehicle-inspections", {
              method: "POST",
              csrf: true,
              signal: controller.signal,
              body,
            })
          ).data,
        );
      }
      if (controller.signal.aborted) return;
      if (action === "save") setSaved(true);
      if (action === "enquire") setEnquired(true);
      if (action === "inspect") setInspected(true);
      setResult({
        action,
        success: true,
        message:
          action === "save"
            ? "This vehicle is saved to your account."
            : action === "inspect"
              ? "Your preferred time is not confirmed yet. Check your account for the agreed appointment."
              : "Your vehicle enquiry has been received. Follow its progress and updates in your account.",
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const apiError = error instanceof ApiError ? error : undefined;
      const uncertain =
        mutationStarted && (!apiError || apiError.status === 0 || apiError.status >= 500);
      if (action === "inspect" && apiError?.fields) {
        if (apiError.fields["body.preferredStartAt"])
          setDateError("Check your preferred date and time.");
        if (apiError.fields["body.notes"])
          setNotesError("Use no more than 2,000 characters for your notes.");
      }
      setResult({
        action,
        success: false,
        login: apiError?.status === 401,
        message: uncertain
          ? "We could not confirm whether your request was received. Check your account before submitting again."
          : apiError?.status === 401
            ? "Sign in to your customer account to continue. Your request has not been sent."
            : apiError?.status === 404
              ? "This vehicle is no longer available for this request. Browse current listings or contact our team."
              : (apiError?.message ??
                "We could not check your account. Please try again."),
      });
    } finally {
      operation.finish(controller);
      if (!controller.signal.aborted) setActive(undefined);
    }
  }
  function feedback(action: "top" | "inspect") {
    if (!result || (result.action === "inspect") !== (action === "inspect")) return null;
    const Heading = action === "inspect" ? "h3" : "h2";
    const href =
      result.action === "inspect"
        ? "/dashboard/inspections"
        : result.action === "save"
          ? "/dashboard/saved"
          : "/dashboard/vehicle-transactions";
    return (
      <div
        className={`vd-feedback ${result.success ? "vd-success" : "vd-error"}`}
        role={result.success ? "status" : "alert"}
      >
        <Heading ref={resultHeading} tabIndex={-1}>
          {result.success
            ? result.action === "inspect"
              ? "Inspection requested"
              : result.action === "save"
                ? "Vehicle saved"
                : "Enquiry received"
            : "Your request needs attention"}
        </Heading>
        <p>{result.message}</p>
        <Link href={result.login ? loginHref : href}>
          {result.login
            ? "Sign in to continue"
            : result.action === "inspect"
              ? "View inspections"
              : result.action === "save"
                ? "View saved vehicles"
                : "View vehicle enquiries"}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="vd-top-grid">
        {gallery}
        <aside className="vd-summary" aria-label="Price and vehicle requests">
          {summary}
          <div ref={accountNotice} tabIndex={operation.sessionChanged ? -1 : undefined}>
            <AccountChangeNotice visible={operation.sessionChanged} />
          </div>
          {feedback("top")}
          <div className="vd-action-buttons">
            <button
              type="button"
              className="button"
              disabled={busy || enquired}
              onClick={() => void submit("enquire")}
            >
              {busy && active === "enquire"
                ? "Sending enquiry…"
                : enquired
                  ? "Enquiry received"
                  : "Enquire about this vehicle"}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || saved}
              onClick={() => void submit("save")}
            >
              <Heart size={17} aria-hidden="true" />
              {busy && active === "save"
                ? "Saving vehicle…"
                : saved
                  ? "Vehicle saved"
                  : "Save vehicle"}
            </button>
          </div>
          <p className="vd-account-note">
            A customer account is required to save or send requests.{" "}
            <Link href={loginHref}>Sign in</Link>
          </p>
          <a
            className="vd-inspection-link"
            href="#inspection"
            onClick={(event) => {
              event.preventDefault();
              history.replaceState(null, "", "#inspection");
              focus(inspectionHeading.current);
            }}
          >
            Request an inspection <ArrowDown size={17} aria-hidden="true" />
          </a>
          <div className="vd-contact">
            <a href={`tel:${business.internationalPhone}`}>
              <Phone size={17} aria-hidden="true" />
              Call our team
            </a>
            <a href={business.whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle size={17} aria-hidden="true" />
              WhatsApp
            </a>
          </div>
        </aside>
      </div>
      {children}
      <section
        className="vd-inspection"
        id="inspection"
        aria-labelledby="vd-inspection-title"
      >
        <div className="vd-inspection-intro">
          <p className="vd-eyebrow">Plan a visit</p>
          <h2>See it for yourself.</h2>
          <p>
            Request a preferred time. Our team will confirm your appointment separately.
          </p>
          <ol>
            <li>
              <strong>Choose a time</strong>
              <span>Use Lagos time for your preferred visit.</span>
            </li>
            <li>
              <strong>Send your request</strong>
              <span>Add anything you would like our team to know.</span>
            </li>
            <li>
              <strong>Check your account</strong>
              <span>Follow the request for appointment updates.</span>
            </li>
          </ol>
        </div>
        <div className="vd-inspection-panel">
          <h2 id="vd-inspection-title" tabIndex={-1} ref={inspectionHeading}>
            Request an inspection
          </h2>
          {feedback("inspect")}
          {inspected ? (
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setInspected(false);
                setResult(undefined);
                setNotesLength(0);
                requestAnimationFrame(() => focus(dateInput.current));
              }}
            >
              Request another inspection
            </button>
          ) : (
            <form
              data-draft-key={JSON.stringify(["vehicle-actions:1", listingId])}
              ref={inspectionForm}
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void submit("inspect", new FormData(event.currentTarget));
              }}
            >
              <div className="field">
                <label htmlFor="inspection-start">
                  Preferred date and time (Lagos time) <span aria-hidden="true">*</span>
                </label>
                <input
                  ref={dateInput}
                  id="inspection-start"
                  name="preferredStartAt"
                  type="datetime-local"
                  required
                  disabled={busy}
                  aria-invalid={!!dateError}
                  aria-describedby={`inspection-time-help${dateError ? " inspection-time-error" : ""}`}
                  onChange={() => setDateError(undefined)}
                />
                <small id="inspection-time-help">
                  West Africa Time (UTC+1). Choose a future date and time.
                </small>
                {dateError && (
                  <p className="vd-field-error" id="inspection-time-error">
                    {dateError}
                  </p>
                )}
              </div>
              <div className="field">
                <label htmlFor="inspection-notes">Notes (optional)</label>
                <textarea
                  id="inspection-notes"
                  name="notes"
                  maxLength={2000}
                  rows={3}
                  disabled={busy}
                  aria-invalid={!!notesError}
                  aria-describedby={`inspection-notes-help${notesError ? " inspection-notes-error" : ""}`}
                  onChange={(event) => {
                    setNotesLength(event.target.value.length);
                    setNotesError(undefined);
                  }}
                />
                <small id="inspection-notes-help">
                  {notesLength.toLocaleString("en-NG")} / 2,000 characters
                </small>
                {notesError && (
                  <p className="vd-field-error" id="inspection-notes-error">
                    {notesError}
                  </p>
                )}
              </div>
              <button className="button" disabled={busy}>
                {busy && active === "inspect" ? "Sending request…" : "Request inspection"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p className="vd-form-note">
                Your request uses the contact details in your customer account.{" "}
                <Link href={loginHref}>Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
