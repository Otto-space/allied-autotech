"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ArrowRight, CheckCircle2 } from "lucide-react";
import { ContactRecordPicker } from "../contact/contact-record-picker";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import {
  enquiryTypes,
  parseSupportRecord,
  publicSupportResult,
  supportCreationSchema,
  supportCreateSchema,
  type SupportKind,
} from "@/lib/api/support-schemas";
import { supportSourceTypes, type SupportSource } from "@/lib/api/support-sources";
import { SupportSourcePicker } from "./support-source-picker";
import { SlotCatalogPicker } from "./slot-catalog-picker";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { CopyControl } from "./copy-control";
import type { useSupportCreateWrite } from "@/lib/support/use-support-create-write";
import { draftIdentity, draftKey, forgetDraft, DRAFT_SAVED } from "@/lib/forms/drafts";
import { visitRequestMessage } from "@/lib/support/visit-request";
import { IntakePrivacyNote } from "./intake-privacy-note";
import visitStyles from "./visit-request.module.css";
function SelectFrame({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return enabled ? (
    <div className="contact-select">
      {children}
      <ChevronDown size={16} aria-hidden="true" />
    </div>
  ) : (
    children
  );
}
export function SupportCreateForm({
  kind,
  publicMode = false,
  locked,
  onUncertain,
  onSaved,
  serviceId,
  serviceName,
  presentation,
  userId,
  guard,
  onReviewChange,
  productId,
  productName,
  initialSubject,
  initialMessage,
  initialContextKey,
  initialEnquiryType,
}: {
  kind: SupportKind;
  publicMode?: boolean;
  locked: boolean;
  onUncertain: () => void;
  onSaved: (id: string) => void;
  serviceId?: string;
  serviceName?: string;
  productId?: string;
  productName?: string;
  initialSubject?: string;
  initialMessage?: string;
  initialContextKey?: string;
  initialEnquiryType?: "PRODUCT";
  presentation?: "contact" | "dashboard";
  userId?: string;
  guard?: ReturnType<typeof useSupportCreateWrite>;
  onReviewChange?: (open: boolean) => void;
}) {
  const [type, setType] = useState(
    serviceId
      ? "SERVICE"
      : kind === "enquiries"
        ? productId || initialEnquiryType === "PRODUCT"
          ? "PRODUCT"
          : "GENERAL"
        : "NONE",
  );
  const [source, setSource] = useState<SupportSource | undefined>(
    serviceId
      ? {
          id: serviceId,
          label: serviceName ?? "Selected service",
          fields: { serviceId },
          inheritsBranch: false,
        }
      : productId && kind === "enquiries"
        ? {
            id: productId,
            label: productName ?? "Selected product",
            fields: { productId },
            inheritsBranch: false,
          }
        : undefined,
  );
  const [branch, setBranch] = useState("");
  const [visitRequested, setVisitRequested] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [visitError, setVisitError] = useState<string>();
  const [branchLabel, setBranchLabel] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);
  const [receiptId, setReceiptId] = useState<string>();
  const [sessionChanged, setSessionChanged] = useState(false);
  const [selectionError, setSelectionError] = useState<"branch" | "source">();
  const successHeading = useRef<HTMLHeadingElement>(null);
  const isContact = presentation === "contact";
  const isDashboard = presentation === "dashboard";
  const [sourceBlocked, setSourceBlocked] = useState(false);
  const [branchBlocked, setBranchBlocked] = useState(false);
  const latestPickerBlocked = useRef(false);
  const pickerBlocked = !!(
    (source && sourceBlocked) ||
    (!source?.inheritsBranch && branchBlocked)
  );
  useEffect(() => {
    latestPickerBlocked.current = pickerBlocked;
  }, [pickerBlocked]);
  useEffect(() => {
    onReviewChange?.(!!proposal);
    return () => onReviewChange?.(false);
  }, [proposal, onReviewChange]);
  const draftId = JSON.stringify(
    isDashboard
      ? ["support-create-form:2", userId, kind]
      : initialContextKey
        ? ["support-create-form:parts:1", initialContextKey, kind]
        : ["support-create-form:1", serviceId, kind],
  );
  useEffect(() => {
    if (complete && isContact) {
      successHeading.current?.focus({ preventScroll: true });
      successHeading.current?.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }, [complete, isContact]);
  const pending = useRef<AbortController | null>(null);
  const draftGeneration = useRef(0);
  useEffect(
    () => () => {
      draftGeneration.current += 1;
      pending.current?.abort();
    },
    [],
  );
  const schema = useMemo(() => supportCreationSchema(publicMode), [publicMode]);
  const form = useForm<z.infer<typeof supportCreateSchema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      subject:
        initialSubject ??
        (serviceName ? `Quotation enquiry: ${serviceName}`.slice(0, 160) : ""),
      message: initialMessage ?? "",
      name: "",
      email: "",
      phone: "",
    },
  });
  const messageValue = useWatch({
    control: form.control,
    name: "message",
    disabled: !isContact && !isDashboard,
  });
  const { reset } = form;
  useEffect(() => {
    if (!publicMode) return;
    function discard() {
      draftGeneration.current += 1;
      if (pending.current) {
        pending.current.abort();
        pending.current = null;
        // An anonymous request remains uncertain regardless of the signed-in account.
        onUncertain();
      }
      setProposal(null);
      setComplete(false);
      setReceiptId(undefined);
      setError(undefined);
      setSessionChanged(true);
      setVisitRequested(false);
      setVisitDate("");
      setVisitTime("");
      setVisitError(undefined);
      setType(
        serviceId
          ? "SERVICE"
          : kind === "enquiries"
            ? productId || initialEnquiryType === "PRODUCT"
              ? "PRODUCT"
              : "GENERAL"
            : "NONE",
      );
      setSource(
        serviceId
          ? {
              id: serviceId,
              label: serviceName ?? "Selected service",
              fields: { serviceId },
              inheritsBranch: false,
            }
          : productId && kind === "enquiries"
            ? {
                id: productId,
                label: productName ?? "Selected product",
                fields: { productId },
                inheritsBranch: false,
              }
            : undefined,
      );
      setBranch("");
      setBranchLabel("");
      reset({
        subject:
          initialSubject ??
          (serviceName ? `Quotation enquiry: ${serviceName}`.slice(0, 160) : ""),
        message: initialMessage ?? "",
        name: "",
        email: "",
        phone: "",
      });
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => window.removeEventListener(SESSION_CHANGED, discard);
  }, [
    publicMode,
    kind,
    serviceId,
    serviceName,
    productId,
    productName,
    initialSubject,
    initialMessage,
    initialEnquiryType,
    reset,
    onUncertain,
  ]);
  const sourceType = supportSourceTypes.find((value) => value === type);
  const choices =
    kind === "enquiries"
      ? enquiryTypes.filter(
          (value) => !publicMode || !["BOOKING", "QUOTATION"].includes(value),
        )
      : publicMode
        ? ["NONE"]
        : ["NONE", "BOOKING", "ORDER", "VEHICLE_TRANSACTION"];
  if (complete)
    return (
      <div
        className={`notice success${isContact ? " contact-success" : ""}`}
        role="status"
      >
        {isContact && <CheckCircle2 size={28} aria-hidden="true" />}
        <h2 ref={successHeading} tabIndex={isContact ? -1 : undefined}>
          {kind === "enquiries" ? "Enquiry received" : "Complaint received"}
        </h2>
        <p>
          {publicMode
            ? "Our team can follow up using the contact details you supplied."
            : "Your record is available in customer care."}{" "}
          No appointment, price or resolution has been confirmed by this submission.
        </p>
        {isContact && (
          <div className="contact-receipt-reference" data-no-draft>
            <label htmlFor="contact-receipt-reference">Your reference</label>
            <input id="contact-receipt-reference" readOnly value={receiptId ?? ""} />
            {receiptId && (
              <CopyControl
                value={receiptId}
                label="Copy reference"
                fieldId="contact-receipt-reference"
              />
            )}
            <p>Keep this reference when contacting our team.</p>
          </div>
        )}
        {isContact && (
          <a
            className="button secondary"
            href="https://wa.me/2348136075567"
            target="_blank"
            rel="noopener noreferrer"
          >
            Continue on WhatsApp
          </a>
        )}
      </div>
    );
  return (
    <section
      className={isDashboard ? "cc-form" : "detail-section"}
      aria-labelledby="support-create-heading"
    >
      <h2 id="support-create-heading" tabIndex={isDashboard ? -1 : undefined}>
        {kind === "enquiries" ? "Send an enquiry" : "Raise a complaint"}
      </h2>
      <p>
        {isContact || isDashboard
          ? "Keep passwords, card details and private documents out of your message."
          : "Please avoid passwords, card details and private documents. There is no response-time guarantee."}
      </p>
      <Feedback
        message={error}
        toast={isContact ? undefined : "Please review the message on this page."}
      />
      {sessionChanged && (
        <Feedback
          tone="info"
          message="Your session changed. Please enter your contact details again. A request already sent may still have completed."
        />
      )}
      {isDashboard && guard && guard.remaining > 0 && (
        <p role="status">
          Wait {guard.remaining} seconds before sending another request.
        </p>
      )}
      {locked && !isDashboard && (
        <p className="notice" role="status">
          This submission has an unknown outcome.{" "}
          {publicMode
            ? "Contact the team before sending it again."
            : "Check your records before starting another submission."}{" "}
          It will not be resent here.
        </p>
      )}
      <form
        data-draft-key={draftId}
        noValidate
        onSubmit={(event) => {
          const generation = draftGeneration.current;
          void form.handleSubmit(
            (values) => {
              if (generation !== draftGeneration.current) return;
              if (locked || proposal || guard?.disabled || pickerBlocked) return;
              setError(undefined);
              setSelectionError(undefined);
              if (sourceType && !source && !(publicMode && type === "PRODUCT")) {
                setSelectionError("source");
                setError("Choose the related record.");
                document.getElementById("support-source")?.focus();
                return;
              }
              if (!source?.inheritsBranch && !branch) {
                setSelectionError("branch");
                setError("Choose the branch handling your request.");
                document.getElementById("support-branch")?.focus();
                return;
              }
              const visit = visitRequestMessage({
                message: values.message,
                type,
                requested: kind === "enquiries" && visitRequested,
                date: visitDate,
                time: visitTime,
              });
              setVisitError(visit.error);
              if (visit.error !== undefined) {
                document.getElementById("support-visit-date")?.focus();
                return;
              }
              const message = visit.message;
              const body = {
                subject: values.subject,
                ...(kind === "enquiries" ? { type, message } : { description: message }),
                ...source?.fields,
                ...(!source?.inheritsBranch ? { branchId: branch } : {}),
                ...(publicMode
                  ? {
                      name: values.name,
                      email: values.email.toLowerCase(),
                      ...(values.phone ? { phone: values.phone } : {}),
                    }
                  : {}),
              };
              setProposal({
                title:
                  kind === "enquiries" ? "Send this enquiry?" : "Submit this complaint?",
                description:
                  "The team will receive these details. This creates a new support record; it does not book an appointment, place an order or promise a refund.",
                facts: [
                  { label: "Subject", value: values.subject },
                  ...(publicMode
                    ? [
                        { label: "Name", value: values.name },
                        { label: "Email", value: values.email.toLowerCase() },
                        ...(values.phone
                          ? [{ label: "Phone", value: values.phone }]
                          : []),
                      ]
                    : []),
                  { label: "Related record", value: source?.label ?? "General" },
                  {
                    label: "Branch",
                    value: source?.inheritsBranch
                      ? "The related record's branch"
                      : branchLabel,
                  },
                  { label: "Message", value: message },
                ],
                retryAfterRejection: false,
                onUncertain,
                submit: async () => {
                  if (guard) {
                    const saved = await guard.run(body, async () => {
                      if (latestPickerBlocked.current)
                        throw new ApiError(409, { error: { code: "CONFLICT" } });
                    });
                    setReceiptId(saved.id);
                    setComplete(true);
                    onSaved(saved.id);
                    return;
                  }
                  if (!publicMode)
                    throw new ApiError(409, { error: { code: "CONFLICT" } });
                  const send = async (signal?: AbortSignal, idempotencyKey?: string) => {
                    const controller = new AbortController();
                    const abort = () => controller.abort();
                    signal?.addEventListener("abort", abort, { once: true });
                    if (signal?.aborted) controller.abort();
                    pending.current = controller;
                    try {
                      const response = await apiRequest(
                        `/${publicMode ? "public" : "customers"}/support/${kind}`,
                        {
                          method: "POST",
                          body,
                          csrf: !publicMode,
                          signal: controller.signal,
                          idempotencyKey,
                        },
                      );
                      controller.signal.throwIfAborted();
                      const saved = publicMode
                        ? publicSupportResult.parse(response.data)
                        : parseSupportRecord(kind, false, response.data);
                      if (
                        "subject" in saved &&
                        (saved.subject !== values.subject ||
                          saved.text !== message ||
                          (saved.kind === "enquiries" && saved.type !== type) ||
                          (branch &&
                            !source?.inheritsBranch &&
                            saved.branchId !== branch))
                      )
                        throw new Error("Unconfirmed support record");
                      if (
                        "subject" in saved &&
                        source &&
                        Object.entries(source.fields).some(
                          ([key, value]) =>
                            !Object.entries(saved).some(
                              ([savedKey, savedValue]) =>
                                savedKey === key && savedValue === value,
                            ),
                        )
                      )
                        throw new Error("Unconfirmed related record");
                      if (isDashboard) {
                        const owner = draftIdentity();
                        if (owner) {
                          const key = draftKey(owner, window.location.pathname, draftId);
                          forgetDraft(key);
                          window.dispatchEvent(
                            new CustomEvent(DRAFT_SAVED, { detail: key }),
                          );
                        }
                      }
                      setReceiptId(saved.id);
                      setComplete(true);
                      return saved.id;
                    } catch (failure) {
                      if (
                        isContact &&
                        failure instanceof ApiError &&
                        failure.status >= 400 &&
                        failure.status < 500 &&
                        failure.fields
                      ) {
                        const fieldNames = [
                          "name",
                          "email",
                          "phone",
                          "subject",
                          "message",
                        ] as const;
                        const invalid = fieldNames.filter(
                          (name) =>
                            failure.fields?.[
                              `body.${name === "message" && kind === "complaints" ? "description" : name}`
                            ],
                        );
                        invalid.forEach((name) =>
                          form.setError(name, {
                            type: "server",
                            message: "Check this field and enter a valid value.",
                          }),
                        );
                        if (invalid.length) {
                          setProposal(null);
                          setError(
                            "Please check the highlighted fields before continuing.",
                          );
                          requestAnimationFrame(() => form.setFocus(invalid[0]));
                        }
                      }
                      throw failure;
                    } finally {
                      signal?.removeEventListener("abort", abort);
                      if (pending.current === controller) pending.current = null;
                    }
                  };
                  const savedId = await send();
                  onSaved(savedId);
                },
              });
            },
            () => {
              if (isContact)
                setError("Please check the highlighted fields before continuing.");
            },
          )(event);
        }}
      >
        <fieldset
          disabled={locked || !!guard?.busy}
          className={
            isContact ? "contact-field-grid" : isDashboard ? "cc-form-grid" : undefined
          }
        >
          {isContact && (
            <legend className="sr-only">Your contact details and request</legend>
          )}
          {publicMode && (
            <>
              {(["name", "email", "phone"] as const).map((name) => (
                <div
                  className={`field${isContact && name === "name" ? " contact-field-wide" : ""}`}
                  key={name}
                >
                  <label htmlFor={`support-${name}`}>
                    {name === "name"
                      ? "Your name"
                      : name === "email"
                        ? "Email address"
                        : "Phone number (optional)"}
                  </label>
                  <input
                    id={`support-${name}`}
                    type={name === "email" ? "email" : name === "phone" ? "tel" : "text"}
                    autoComplete={name === "phone" ? "tel" : name}
                    required={isContact && name !== "phone"}
                    maxLength={name === "name" ? 120 : name === "email" ? 254 : 32}
                    {...form.register(name)}
                    aria-invalid={!!form.formState.errors[name]}
                    aria-describedby={`support-${name}-error`}
                  />
                  <p id={`support-${name}-error`} className="field-error">
                    {form.formState.errors[name]?.message}
                  </p>
                </div>
              ))}
            </>
          )}
          {!serviceId && (
            <div className="field">
              <label htmlFor="support-type">
                {kind === "enquiries" ? "Enquiry type" : "Related transaction"}
              </label>
              <SelectFrame enabled={isContact}>
                <select
                  id="support-type"
                  name={isDashboard ? "supportType" : undefined}
                  data-draft-context={isDashboard || undefined}
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value);
                    setSource(undefined);
                    setSourceBlocked(false);
                    setVisitRequested(false);
                    setVisitError(undefined);
                    setError(undefined);
                  }}
                >
                  {choices.map((value) => (
                    <option key={value} value={value}>
                      {value === "NONE"
                        ? "No related transaction"
                        : isContact || isDashboard
                          ? value[0] + value.slice(1).toLowerCase().replaceAll("_", " ")
                          : value.toLowerCase().replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </SelectFrame>
            </div>
          )}
          {sourceType &&
            !serviceId &&
            (isContact ? (
              <div className="field contact-field-wide">
                <label htmlFor="support-source">
                  {publicMode && type === "PRODUCT"
                    ? "Related product (optional)"
                    : "Related record"}
                </label>
                <ContactRecordPicker
                  key={sourceType}
                  id="support-source"
                  kind={sourceType}
                  required={!(publicMode && type === "PRODUCT")}
                  value={source}
                  onChange={(value) => {
                    setSource(value);
                    setSelectionError(undefined);
                  }}
                  error={
                    selectionError === "source" ? "Choose the related record." : undefined
                  }
                />
              </div>
            ) : (
              <SupportSourcePicker
                key={sourceType}
                type={sourceType}
                value={source}
                onChange={setSource}
                onAvailabilityChange={isDashboard ? setSourceBlocked : undefined}
                draftContext={isDashboard}
              />
            ))}
          {serviceId && <p>Related service: {serviceName ?? "Selected service"}</p>}
          {source?.inheritsBranch ? (
            <p>The related record determines the handling branch.</p>
          ) : (
            <div className="field">
              <label htmlFor="support-branch">Handling branch</label>
              {isContact ? (
                <ContactRecordPicker
                  id="support-branch"
                  kind="branch"
                  value={
                    branch
                      ? {
                          id: branch,
                          label: branchLabel,
                          fields: { branchId: branch },
                          inheritsBranch: false,
                        }
                      : undefined
                  }
                  onChange={(value) => {
                    setBranch(value?.id ?? "");
                    setBranchLabel(value?.label ?? "");
                    setSelectionError(undefined);
                  }}
                  error={
                    selectionError === "branch"
                      ? "Choose the branch handling your request."
                      : undefined
                  }
                />
              ) : (
                <SlotCatalogPicker
                  kind="branch"
                  id="support-branch"
                  value={branch}
                  onAvailabilityChange={isDashboard ? setBranchBlocked : undefined}
                  draftContext={isDashboard}
                  error={
                    isDashboard && selectionError === "branch"
                      ? "Choose the branch handling your request."
                      : undefined
                  }
                  onChange={(value, label) => {
                    setBranch(value);
                    setBranchLabel(label);
                  }}
                />
              )}
            </div>
          )}
          <div className={`field${isContact ? " contact-field-wide" : ""}`}>
            <label htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              required={isContact}
              maxLength={160}
              {...form.register("subject")}
              aria-invalid={!!form.formState.errors.subject}
              aria-describedby={
                isDashboard
                  ? "support-subject-hint support-subject-error"
                  : "support-subject-error"
              }
            />
            {isDashboard && (
              <p id="support-subject-hint" className="cc-field-help">
                A short summary helps the team recognise your request.
              </p>
            )}
            <p id="support-subject-error" className="field-error">
              {form.formState.errors.subject?.message}
            </p>
          </div>
          <div className={`field${isContact ? " contact-field-wide" : ""}`}>
            <label htmlFor="support-opening">
              {kind === "enquiries" ? "Your message" : "Complaint details"}
            </label>
            <textarea
              id="support-opening"
              required={isContact}
              rows={5}
              maxLength={4000}
              {...form.register("message")}
              aria-invalid={!!form.formState.errors.message}
              aria-describedby={
                isDashboard
                  ? "support-opening-hint support-opening-error"
                  : "support-opening-error"
              }
            />
            {isDashboard && (
              <p id="support-opening-hint" className="cc-field-help">
                {kind === "enquiries"
                  ? "Include the vehicle or part details and what you need help with."
                  : "Explain what happened, when it happened and how you would like us to help."}
              </p>
            )}
            <p id="support-opening-error" className="field-error">
              {form.formState.errors.message?.message}
            </p>
            {(isContact || isDashboard) && (
              <p
                className={isDashboard ? "cc-character-count" : "contact-character-count"}
                aria-label={`${messageValue?.length ?? 0} of 4000 characters`}
              >
                {messageValue?.length ?? 0}
                {isDashboard ? " / 4000 characters" : "/4000"}
              </p>
            )}
          </div>
          {kind === "enquiries" && ["SERVICE", "VEHICLE"].includes(type) && (
            <fieldset className={`field contact-field-wide ${visitStyles.request}`}>
              <legend>
                {type === "SERVICE"
                  ? "Request a service visit"
                  : "Request a vehicle inspection"}
              </legend>
              <label className={visitStyles.toggle}>
                <input
                  type="checkbox"
                  name="visitRequested"
                  checked={visitRequested}
                  onChange={(event) => {
                    setVisitRequested(event.target.checked);
                    setVisitError(undefined);
                  }}
                />
                Include my preferred date and time
              </label>
              <p>
                Our team will check availability and contact you to confirm. This request
                collects no payment and does not hold an appointment or vehicle.
              </p>
              {visitRequested && (
                <>
                  <div className="field">
                    <label htmlFor="support-visit-date">
                      Preferred date (Nigeria time)
                    </label>
                    <input
                      id="support-visit-date"
                      type="date"
                      name="visitDate"
                      value={visitDate}
                      onChange={(event) => setVisitDate(event.target.value)}
                      aria-invalid={!!visitError}
                      aria-describedby="support-visit-error"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="support-visit-time">
                      Preferred time (Nigeria time)
                    </label>
                    <input
                      id="support-visit-time"
                      type="time"
                      name="visitTime"
                      value={visitTime}
                      onChange={(event) => setVisitTime(event.target.value)}
                      aria-invalid={!!visitError}
                      aria-describedby="support-visit-error"
                    />
                  </div>
                  <p
                    id="support-visit-error"
                    className="field-error"
                    role={visitError ? "alert" : undefined}
                  >
                    {visitError}
                  </p>
                </>
              )}
            </fieldset>
          )}
          <div className="contact-field-wide">
            <IntakePrivacyNote />
          </div>
          <button
            type="submit"
            className="button"
            disabled={!!guard?.disabled || pickerBlocked}
          >
            Review {kind === "enquiries" ? "enquiry" : "complaint"}
            {isContact && <ArrowRight size={16} aria-hidden="true" />}
          </button>
          {isDashboard && (
            <p className="cc-form-help">Review your details before sending.</p>
          )}
          {isContact && (
            <p className="contact-field-help contact-field-wide">
              You can check your details before sending.
            </p>
          )}
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
          exposeBusyState={isContact || isDashboard}
          confirmLabel={
            isContact || isDashboard
              ? kind === "enquiries"
                ? "Send enquiry"
                : "Send complaint"
              : undefined
          }
        />
      )}
    </section>
  );
}
