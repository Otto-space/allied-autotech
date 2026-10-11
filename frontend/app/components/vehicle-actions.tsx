"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  CarFront,
  Check,
  Heart,
  Info,
  MessageCircle,
  Phone,
} from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import {
  canRetryVehicleCreation,
  clearVehicleRetry,
  readVehicleRetry,
  saveVehicleRetry,
  redactVehicleRetries,
  type VehicleCreationAction,
  type VehicleCreationIntent,
  type VehicleRetry,
} from "@/lib/api/vehicle-creation-retry";
import type { RequestBody } from "@/lib/api/contracts";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { business } from "@/lib/business";
import { inspectionInstant } from "@/lib/vehicle-detail";
import { AccountChangeNotice } from "./account-change-notice";
import { CopyControl } from "./copy-control";

const identity = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
});
const receipt = z.object({ id: z.uuid() });
type Action = "save" | "enquire" | "inspect";
type Result = {
  action: Action;
  success: boolean;
  message: string;
  login?: boolean;
  reference?: string;
};
type Review =
  { action: "enquire" } | { action: "inspect"; localTime: string; notes: string };

export function VehicleActions({
  listingId,
  listingTitle,
  branchName,
  gallery,
  summary,
  children,
}: {
  listingId: string;
  listingTitle: string;
  branchName: string;
  gallery: ReactNode;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [result, setResult] = useState<Result>();
  const [receipts, setReceipts] = useState<Partial<Record<"top" | "inspect", Result>>>(
    {},
  );
  const [active, setActive] = useState<Action>();
  const [saved, setSaved] = useState(false);
  const [enquired, setEnquired] = useState(false);
  const [inspected, setInspected] = useState(false);
  const [dateError, setDateError] = useState<string>();
  const [notesError, setNotesError] = useState<string>();
  const [notesLength, setNotesLength] = useState(0);
  const [review, setReview] = useState<Review>();
  const [uncertain, setUncertain] = useState<Partial<Record<Action, boolean>>>({});
  const [recovery, setRecovery] = useState<
    Partial<Record<VehicleCreationAction, VehicleRetry>>
  >({});
  const owner = useRef<string | undefined>(undefined);
  const [access, setAccess] = useState<
    "checking" | "customer" | "anonymous" | "restricted" | "error"
  >("checking");
  const [accessRetry, setAccessRetry] = useState(0);
  useEffect(() => {
    let pending: AbortController | undefined;
    async function check() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await apiRequest("/auth/session", {
          optionalSession: true,
          signal: controller.signal,
        });
        const session = identity.parse(response.data);
        if (!controller.signal.aborted) {
          owner.current = session.user.id;
          const next =
            session.user.role === "CUSTOMER"
              ? {
                  inspect: readVehicleRetry(session.user.id, listingId, "inspect"),
                  enquire: readVehicleRetry(session.user.id, listingId, "enquire"),
                }
              : {};
          setRecovery(next);
          setUncertain({ inspect: !!next.inspect, enquire: !!next.enquire });
          setAccess(session.user.role === "CUSTOMER" ? "customer" : "restricted");
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setAccess(
            error instanceof ApiError && error.status === 401 ? "anonymous" : "error",
          );
      }
    }
    function changed() {
      redactVehicleRetries();
      setAccess("checking");
      void check();
    }
    void check();
    window.addEventListener(SESSION_CHANGED, changed);
    return () => {
      pending?.abort();
      window.removeEventListener(SESSION_CHANGED, changed);
    };
  }, [accessRetry, listingId]);
  const inspectionForm = useRef<HTMLFormElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const inspectionResultHeading = useRef<HTMLHeadingElement>(null);
  const accountNotice = useRef<HTMLDivElement>(null);
  const inspectionHeading = useRef<HTMLHeadingElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const notesInput = useRef<HTMLTextAreaElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const enquiryButton = useRef<HTMLButtonElement>(null);
  const discard = useCallback(() => {
    setResult(undefined);
    setReceipts({});
    setActive(undefined);
    setSaved(false);
    setEnquired(false);
    setInspected(false);
    setDateError(undefined);
    setNotesError(undefined);
    setNotesLength(0);
    setReview(undefined);
    setUncertain({});
    setRecovery({});
    owner.current = undefined;
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
    if (result)
      focus(
        result.action === "inspect"
          ? inspectionResultHeading.current
          : resultHeading.current,
      );
  }, [result]);
  useEffect(() => {
    if (operation.sessionChanged) focus(accountNotice.current);
  }, [operation.sessionChanged]);
  useEffect(() => {
    if (review) focus(reviewHeading.current);
  }, [review]);

  function prepareInspection(form: FormData) {
    if (busy || uncertain.inspect || access !== "customer") return;
    const localTime = String(form.get("preferredStartAt") ?? "");
    const notes = String(form.get("notes") ?? "").trim();
    setResult(undefined);
    if (!inspectionInstant(localTime)) {
      setDateError("Choose a future date and time in Lagos time.");
      focus(dateInput.current);
      return;
    }
    if (notes.length > 2000) {
      setNotesError("Use no more than 2,000 characters for your notes.");
      focus(notesInput.current);
      return;
    }
    setDateError(undefined);
    setNotesError(undefined);
    setReview({ action: "inspect", localTime, notes });
  }

  function editReview() {
    if (busy) return;
    const action = review?.action;
    setReview(undefined);
    requestAnimationFrame(() =>
      focus(action === "inspect" ? dateInput.current : enquiryButton.current),
    );
  }

  async function submit(action: Action, retry?: VehicleCreationIntent) {
    if (busy || (uncertain[action] && !retry) || access !== "customer") return;
    if (action !== "save" && !retry && review?.action !== action) return;
    if (retry && (retry.action !== action || !canRetryVehicleCreation(retry))) {
      setRecovery((value) => ({ ...value, [action]: { kind: "history" } }));
      return;
    }
    const preferred =
      retry?.action === "inspect"
        ? retry.body.preferredStartAt
        : action === "inspect" && review?.action === "inspect"
          ? inspectionInstant(review.localTime)
          : undefined;
    if (action === "inspect" && !preferred) {
      setDateError("Choose a future date and time in Lagos time.");
      setResult(undefined);
      setReview(undefined);
      requestAnimationFrame(() => focus(dateInput.current));
      return;
    }
    const controller = operation.begin();
    if (!controller) return;
    setResult(undefined);
    setDateError(undefined);
    setNotesError(undefined);
    setActive(action);
    let mutationStarted = false;
    let intent = retry;
    let reference: string | undefined;
    try {
      const session = identity.parse(
        (
          await apiRequest("/auth/session", {
            signal: controller.signal,
            optionalSession: true,
          })
        ).data,
      );
      if (controller.signal.aborted) return;
      if (session.user.role !== "CUSTOMER") {
        setAccess("restricted");
        discard();
        return;
      }
      if (
        owner.current !== session.user.id ||
        (retry && retry.owner !== session.user.id)
      ) {
        discard();
        setAccess("checking");
        setAccessRetry((value) => value + 1);
        return;
      }
      if (action !== "save") {
        // Re-read immediately before sending; stale UI must not overwrite an
        // unresolved intent left by an earlier mount of this page.
        const stored = readVehicleRetry(session.user.id, listingId, action);
        if (!retry && stored) {
          setRecovery((value) => ({ ...value, [action]: stored }));
          setUncertain((value) => ({ ...value, [action]: true }));
          setReview(undefined);
          return;
        }
        if (retry && (stored?.kind !== "pending" || stored.intent.key !== retry.key)) {
          setRecovery((value) => ({ ...value, [action]: stored ?? { kind: "history" } }));
          return;
        }
        if (!intent) {
          const base = {
            owner: session.user.id,
            key: crypto.randomUUID(),
            startedAt: Date.now(),
          };
          const notes = review?.action === "inspect" ? review.notes : "";
          intent =
            action === "enquire"
              ? { ...base, action, body: { vehicleListingId: listingId } }
              : {
                  ...base,
                  action,
                  body: {
                    vehicleListingId: listingId,
                    preferredStartAt: preferred!,
                    ...(notes ? { notes } : {}),
                  },
                };
          try {
            saveVehicleRetry(intent);
          } catch {
            throw new Error("REQUEST_RECOVERY_UNAVAILABLE");
          }
        }
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
        if (intent?.action !== "enquire") throw new Error("Invalid enquiry intent");
        const body: RequestBody<"/customers/vehicle-transactions", "post"> = intent.body;
        mutationStarted = true;
        reference = receipt.parse(
          (
            await apiRequest("/customers/vehicle-transactions", {
              method: "POST",
              csrf: true,
              signal: controller.signal,
              body,
              idempotencyKey: intent.key,
            })
          ).data,
        ).id;
      } else {
        if (intent?.action !== "inspect") throw new Error("Invalid inspection intent");
        const body: RequestBody<"/customers/vehicle-inspections", "post"> = intent.body;
        mutationStarted = true;
        reference = receipt.parse(
          (
            await apiRequest("/customers/vehicle-inspections", {
              method: "POST",
              csrf: true,
              signal: controller.signal,
              body,
              idempotencyKey: intent.key,
            })
          ).data,
        ).id;
      }
      if (controller.signal.aborted) return;
      if (intent) {
        const completedAction = intent.action;
        clearVehicleRetry(intent.owner, listingId, intent.action);
        setRecovery((value) => ({ ...value, [completedAction]: undefined }));
        setUncertain((value) => ({ ...value, [completedAction]: false }));
      }
      if (action === "save") setSaved(true);
      if (action === "enquire") setEnquired(true);
      if (action === "inspect") {
        // The review action sits outside the editor form. Explicitly clear its
        // saved draft after a confirmed write, before the editor unmounts.
        inspectionForm.current?.reset();
        setNotesLength(0);
        setInspected(true);
      }
      setReview(undefined);
      const received: Result = {
        action,
        reference,
        success: true,
        message:
          action === "save"
            ? "This vehicle is saved to your account."
            : action === "inspect"
              ? "Your preferred time is not confirmed yet. Check your account for the agreed appointment."
              : "Your vehicle enquiry has been received. Follow its progress and updates in your account.",
      };
      setResult(received);
      if (reference)
        setReceipts((value) => ({
          ...value,
          [action === "inspect" ? "inspect" : "top"]: received,
        }));
    } catch (error) {
      if (controller.signal.aborted) return;
      const apiError = error instanceof ApiError ? error : undefined;
      if (apiError?.status === 401) setAccess("anonymous");
      const outcomeUnknown =
        mutationStarted && (!apiError || apiError.status === 0 || apiError.status >= 500);
      if (outcomeUnknown) setUncertain((value) => ({ ...value, [action]: true }));
      if (intent && (outcomeUnknown || retry)) {
        const pendingIntent = intent;
        setRecovery((value) => ({
          ...value,
          [pendingIntent.action]: { kind: "pending", intent: pendingIntent },
        }));
      } else if (intent) {
        clearVehicleRetry(intent.owner, listingId, intent.action);
      }
      setReview(undefined);
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
        message: outcomeUnknown
          ? "We could not confirm whether your request was received. Check your account before submitting again."
          : error instanceof Error && error.message === "REQUEST_RECOVERY_UNAVAILABLE"
            ? "Your browser could not save this request for recovery. Allow site storage and try again."
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
    const currentResult =
      result && (result.action === "inspect") === (action === "inspect")
        ? result
        : receipts[action];
    if (!currentResult) return null;
    const feedbackResult = currentResult;
    const Heading = action === "inspect" ? "h3" : "h2";
    const href =
      feedbackResult.action === "inspect"
        ? "/dashboard/inspections"
        : feedbackResult.action === "save"
          ? "/dashboard/saved"
          : feedbackResult.reference
            ? `/dashboard/vehicle-transactions/${feedbackResult.reference}`
            : "/dashboard/vehicle-transactions";
    return (
      <div
        className={`vd-feedback ${feedbackResult.success ? "vd-success" : "vd-error"}`}
        role={feedbackResult.success ? "status" : "alert"}
      >
        {feedbackResult.success && feedbackResult.reference && (
          <Check className="vd-receipt-icon" size={22} aria-hidden="true" />
        )}
        <Heading
          ref={action === "inspect" ? inspectionResultHeading : resultHeading}
          tabIndex={-1}
        >
          {feedbackResult.success
            ? feedbackResult.action === "inspect"
              ? "Inspection requested"
              : feedbackResult.action === "save"
                ? "Vehicle saved"
                : "Enquiry received"
            : "Your request needs attention"}
        </Heading>
        <p>{feedbackResult.message}</p>
        {feedbackResult.reference && (
          <div className="vd-request-reference">
            <label htmlFor={`vehicle-${feedbackResult.action}-reference`}>
              Request reference
            </label>
            <textarea
              id={`vehicle-${feedbackResult.action}-reference`}
              rows={2}
              readOnly
              value={feedbackResult.reference}
            />
            <CopyControl
              key={feedbackResult.reference}
              value={feedbackResult.reference}
              label="Copy reference"
              fieldId={`vehicle-${feedbackResult.action}-reference`}
            />
          </div>
        )}
        <Link href={feedbackResult.login ? loginHref : href}>
          {feedbackResult.login
            ? "Sign in to continue"
            : feedbackResult.action === "inspect"
              ? "View inspections"
              : feedbackResult.action === "save"
                ? "View saved vehicles"
                : feedbackResult.reference
                  ? "View vehicle enquiry"
                  : "View vehicle enquiries"}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  }
  function accessMessage() {
    if (access === "customer") return null;
    return (
      <div className="vd-access">
        <p role="status">
          {access === "checking"
            ? "Checking your account…"
            : access === "anonymous"
              ? "A customer account is required to save or send requests."
              : access === "restricted"
                ? "Customer requests are unavailable on work accounts. Contact our team for help."
                : "We could not check your account. Please try again."}
        </p>
        {access === "anonymous" && (
          <Link className="button" href={loginHref}>
            Sign in to continue <ArrowRight size={17} aria-hidden="true" />
          </Link>
        )}
        {access === "restricted" && (
          <Link className="button secondary" href="/admin">
            Go to dashboard <ArrowRight size={17} aria-hidden="true" />
          </Link>
        )}
        {access === "error" && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setAccess("checking");
              setAccessRetry((value) => value + 1);
            }}
          >
            Retry account check
          </button>
        )}
      </div>
    );
  }
  function vehicleContext() {
    return (
      <div className="vd-request-vehicle">
        <CarFront size={25} aria-hidden="true" />
        <div>
          <strong>{listingTitle}</strong>
          <span>{branchName}</span>
        </div>
      </div>
    );
  }
  const inspection = review?.action === "inspect";
  const reviewPanel =
    review && access === "customer" ? (
      <section
        className="vd-request-review"
        aria-label={inspection ? "Inspection request review" : "Vehicle enquiry review"}
      >
        {!inspection && (
          <>
            <p className="vd-request-step">Vehicle enquiry</p>
            <h2 ref={reviewHeading} tabIndex={-1}>
              Review your enquiry
            </h2>
            {vehicleContext()}
          </>
        )}
        {inspection ? (
          <dl className="vd-review-facts">
            <div>
              <dt>Preferred time</dt>
              <dd>
                {new Intl.DateTimeFormat("en-NG", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Africa/Lagos",
                }).format(new Date(`${review.localTime}:00+01:00`))}
                <small>Lagos time (UTC+1)</small>
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{review.notes || "No additional notes"}</dd>
            </div>
          </dl>
        ) : (
          <p>
            Send your interest to our team using the contact details in your customer
            account. Follow the enquiry and updates in your account.
          </p>
        )}
        <p className="vd-request-guidance">
          <Info size={18} aria-hidden="true" />
          <span>
            {inspection
              ? "This is a preferred time. Your appointment is confirmed separately."
              : "Sending an enquiry does not reserve this vehicle."}
          </span>
        </p>
        <div className="vd-review-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void submit(review.action)}
          >
            {busy
              ? "Sending request…"
              : inspection
                ? "Send inspection request"
                : "Send vehicle enquiry"}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={editReview}
          >
            {inspection ? "Edit details" : "Go back"}
          </button>
        </div>
      </section>
    ) : null;
  function uncertaintyNotice(action: "inspect" | "enquire") {
    if (!uncertain[action] || access !== "customer") return null;
    const pending = recovery[action];
    return (
      <section
        className="vd-request-review"
        aria-label={
          action === "inspect" ? "Recover inspection request" : "Recover vehicle enquiry"
        }
      >
        <p className="vd-request-guidance">
          <Info size={18} aria-hidden="true" />
          <span>
            {pending?.kind === "pending"
              ? "The previous request may have been received. Retry the same request to recover its reference."
              : pending?.kind === "unavailable"
                ? "Your browser cannot access saved requests. Allow site storage, then retry the recovery check."
                : "The previous request cannot be safely retried from this browser. Check your account history before starting another request."}{" "}
            <Link
              href={
                action === "inspect"
                  ? "/dashboard/inspections"
                  : "/dashboard/vehicle-transactions"
              }
            >
              Check your account
            </Link>{" "}
          </span>
        </p>
        {pending?.kind === "pending" && pending.intent.action === "inspect" && (
          <dl className="vd-review-facts">
            <div>
              <dt>Original preferred time</dt>
              <dd>
                {new Intl.DateTimeFormat("en-NG", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Africa/Lagos",
                }).format(new Date(pending.intent.body.preferredStartAt))}{" "}
                (Lagos time)
              </dd>
            </div>
            <div>
              <dt>Original notes</dt>
              <dd>{pending.intent.body.notes || "No additional notes"}</dd>
            </div>
          </dl>
        )}
        <div className="vd-review-actions">
          {pending?.kind === "unavailable" && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setAccess("checking");
                setAccessRetry((value) => value + 1);
              }}
            >
              Retry recovery check
            </button>
          )}
          {pending?.kind === "pending" && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void submit(action, pending.intent)}
            >
              {busy && active === action
                ? "Recovering request…"
                : action === "inspect"
                  ? "Retry original inspection request"
                  : "Retry original vehicle enquiry"}
            </button>
          )}
          {pending?.kind !== "unavailable" && (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (
                  owner.current &&
                  clearVehicleRetry(owner.current, listingId, action)
                ) {
                  setRecovery((value) => ({ ...value, [action]: undefined }));
                  setUncertain((value) => ({ ...value, [action]: false }));
                  setResult(undefined);
                }
              }}
            >
              I’ve checked my history. Start a new request
            </button>
          )}
        </div>
      </section>
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
          {uncertaintyNotice("enquire")}
          {accessMessage()}
          {access === "customer" && (
            <>
              {review?.action === "enquire" && reviewPanel}
              <div className="vd-action-buttons">
                {review?.action !== "enquire" && (
                  <button
                    ref={enquiryButton}
                    type="button"
                    className="button"
                    disabled={busy || enquired || !!review || !!uncertain.enquire}
                    onClick={() => {
                      setResult(undefined);
                      setReview({ action: "enquire" });
                    }}
                  >
                    {busy && active === "enquire"
                      ? "Sending enquiry…"
                      : enquired
                        ? "Enquiry received"
                        : "Enquire about this vehicle"}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || saved || !!review || !!uncertain.save}
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
              <p className="vd-account-note">Requests use your customer account.</p>
              <a
                className="vd-inspection-link"
                href="#inspection"
                onClick={(event) => {
                  event.preventDefault();
                  history.replaceState(null, "", "#inspection");
                  focus(document.getElementById("vd-inspection-title"));
                }}
              >
                Request an inspection <ArrowDown size={17} aria-hidden="true" />
              </a>
            </>
          )}
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
        {children}
      </div>
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
        </div>
        <div className="vd-inspection-steps">
          <ol>
            <li>
              <strong>Choose a time</strong>
              <span>Use Lagos time for your preferred visit.</span>
            </li>
            <li>
              <strong>Review your request</strong>
              <span>Check the details before you send.</span>
            </li>
            <li>
              <strong>Follow your appointment</strong>
              <span>Follow the request for appointment updates.</span>
            </li>
          </ol>
        </div>
        <div className="vd-inspection-panel">
          <p className="vd-request-step">
            {inspected
              ? "03 / Request sent"
              : review?.action === "inspect"
                ? "02 / Review"
                : "01 / Request details"}
          </p>
          <h2
            id="vd-inspection-title"
            tabIndex={-1}
            ref={review?.action === "inspect" ? reviewHeading : inspectionHeading}
          >
            {review?.action === "inspect"
              ? "Review your inspection"
              : "Request an inspection"}
          </h2>
          {vehicleContext()}
          {feedback("inspect")}
          {uncertaintyNotice("inspect")}
          {access !== "customer" ? (
            accessMessage()
          ) : inspected ? (
            <button
              className="button secondary"
              type="button"
              disabled={busy || !!review}
              onClick={() => {
                setInspected(false);
                setResult(undefined);
                setReceipts((value) => ({ ...value, inspect: undefined }));
                setNotesLength(0);
                requestAnimationFrame(() => focus(dateInput.current));
              }}
            >
              Request another inspection
            </button>
          ) : (
            <>
              {review?.action === "inspect" && reviewPanel}
              <form
                hidden={review?.action === "inspect"}
                data-draft-key={JSON.stringify(["vehicle-actions:1", listingId])}
                ref={inspectionForm}
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  prepareInspection(new FormData(event.currentTarget));
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
                    disabled={busy || !!uncertain.inspect || !!review}
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
                    ref={notesInput}
                    id="inspection-notes"
                    name="notes"
                    maxLength={2000}
                    rows={3}
                    disabled={busy || !!uncertain.inspect || !!review}
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
                <button
                  className="button"
                  disabled={busy || !!uncertain.inspect || !!review}
                >
                  Review inspection
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
                <p className="vd-form-note">
                  Your request uses the contact details in your customer account.
                </p>
              </form>
            </>
          )}
        </div>
      </section>
    </>
  );
}
