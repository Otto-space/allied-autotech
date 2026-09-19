"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
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
export function SupportCreateForm({
  kind,
  publicMode = false,
  locked,
  onUncertain,
  onSaved,
  serviceId,
  serviceName,
}: {
  kind: SupportKind;
  publicMode?: boolean;
  locked: boolean;
  onUncertain: () => void;
  onSaved: (id: string) => void;
  serviceId?: string;
  serviceName?: string;
}) {
  const [type, setType] = useState(
    serviceId ? "SERVICE" : kind === "enquiries" ? "GENERAL" : "NONE",
  );
  const [source, setSource] = useState<SupportSource | undefined>(
    serviceId
      ? {
          id: serviceId,
          label: serviceName ?? "Selected service",
          fields: { serviceId },
          inheritsBranch: false,
        }
      : undefined,
  );
  const [branch, setBranch] = useState("");
  const [branchLabel, setBranchLabel] = useState("");
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);
  const [sessionChanged, setSessionChanged] = useState(false);
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
      subject: serviceName ? `Quotation enquiry: ${serviceName}`.slice(0, 160) : "",
      message: "",
      name: "",
      email: "",
      phone: "",
    },
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
      setError(undefined);
      setSessionChanged(true);
      setType(serviceId ? "SERVICE" : kind === "enquiries" ? "GENERAL" : "NONE");
      setSource(
        serviceId
          ? {
              id: serviceId,
              label: serviceName ?? "Selected service",
              fields: { serviceId },
              inheritsBranch: false,
            }
          : undefined,
      );
      setBranch("");
      setBranchLabel("");
      reset({
        subject: serviceName ? `Quotation enquiry: ${serviceName}`.slice(0, 160) : "",
        message: "",
        name: "",
        email: "",
        phone: "",
      });
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => window.removeEventListener(SESSION_CHANGED, discard);
  }, [publicMode, kind, serviceId, serviceName, reset, onUncertain]);
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
      <div className="notice success" role="status">
        <h2>{kind === "enquiries" ? "Enquiry received" : "Complaint received"}</h2>
        <p>
          {publicMode
            ? "Our team can follow up using the contact details you supplied."
            : "Your record is available in customer care."}{" "}
          No appointment, price or resolution has been confirmed by this submission.
        </p>
      </div>
    );
  return (
    <section className="detail-section" aria-labelledby="support-create-heading">
      <h2 id="support-create-heading">
        {kind === "enquiries" ? "Send an enquiry" : "Raise a complaint"}
      </h2>
      <p>
        Please avoid passwords, card details and private documents. There is no
        response-time guarantee.
      </p>
      <Feedback message={error} />
      {sessionChanged && (
        <Feedback
          tone="info"
          message="Your session changed. Please enter your contact details again. A request already sent may still have completed."
        />
      )}
      {locked && (
        <p className="notice" role="status">
          This submission has an unknown outcome.{" "}
          {publicMode
            ? "Contact the team before sending it again."
            : "Check your records before starting another submission."}{" "}
          It will not be resent here.
        </p>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          const generation = draftGeneration.current;
          void form.handleSubmit((values) => {
            if (generation !== draftGeneration.current) return;
            if (locked || proposal) return;
            setError(undefined);
            if (sourceType && !source) {
              setError("Choose the related record.");
              document.getElementById("support-source")?.focus();
              return;
            }
            if (!source?.inheritsBranch && !branch) {
              setError("Choose the branch handling your request.");
              document.getElementById("support-branch")?.focus();
              return;
            }
            const body = {
              subject: values.subject,
              ...(kind === "enquiries"
                ? { type, message: values.message }
                : { description: values.message }),
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
                      ...(values.phone ? [{ label: "Phone", value: values.phone }] : []),
                    ]
                  : []),
                { label: "Related record", value: source?.label ?? "General" },
                {
                  label: "Branch",
                  value: source?.inheritsBranch
                    ? "The related record's branch"
                    : branchLabel,
                },
                { label: "Message", value: values.message },
              ],
              retryAfterRejection: false,
              onUncertain,
              submit: async () => {
                const controller = new AbortController();
                pending.current = controller;
                try {
                  const response = await apiRequest(
                    `/${publicMode ? "public" : "customers"}/support/${kind}`,
                    {
                      method: "POST",
                      body,
                      csrf: !publicMode,
                      signal: controller.signal,
                    },
                  );
                  controller.signal.throwIfAborted();
                  const saved = publicMode
                    ? publicSupportResult.parse(response.data)
                    : parseSupportRecord(kind, false, response.data);
                  if (
                    "subject" in saved &&
                    (saved.subject !== values.subject ||
                      saved.text !== values.message ||
                      (saved.kind === "enquiries" && saved.type !== type) ||
                      (branch && !source?.inheritsBranch && saved.branchId !== branch))
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
                  setComplete(true);
                  onSaved(saved.id);
                } finally {
                  if (pending.current === controller) pending.current = null;
                }
              },
            });
          })(event);
        }}
      >
        <fieldset disabled={locked}>
          {publicMode && (
            <>
              {(["name", "email", "phone"] as const).map((name) => (
                <div className="field" key={name}>
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
              <select
                id="support-type"
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  setSource(undefined);
                  setError(undefined);
                }}
              >
                {choices.map((value) => (
                  <option key={value} value={value}>
                    {value === "NONE"
                      ? "No related transaction"
                      : value.toLowerCase().replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          )}
          {sourceType && !serviceId && (
            <SupportSourcePicker
              key={sourceType}
              type={sourceType}
              value={source}
              onChange={setSource}
            />
          )}
          {serviceId && <p>Related service: {serviceName ?? "Selected service"}</p>}
          {source?.inheritsBranch ? (
            <p>The related record determines the handling branch.</p>
          ) : (
            <div className="field">
              <label htmlFor="support-branch">Handling branch</label>
              <SlotCatalogPicker
                kind="branch"
                id="support-branch"
                value={branch}
                onChange={(value, label) => {
                  setBranch(value);
                  setBranchLabel(label);
                }}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              maxLength={160}
              {...form.register("subject")}
              aria-invalid={!!form.formState.errors.subject}
              aria-describedby="support-subject-error"
            />
            <p id="support-subject-error" className="field-error">
              {form.formState.errors.subject?.message}
            </p>
          </div>
          <div className="field">
            <label htmlFor="support-opening">
              {kind === "enquiries" ? "Your message" : "Complaint details"}
            </label>
            <textarea
              id="support-opening"
              rows={5}
              maxLength={4000}
              {...form.register("message")}
              aria-invalid={!!form.formState.errors.message}
              aria-describedby="support-opening-error"
            />
            <p id="support-opening-error" className="field-error">
              {form.formState.errors.message?.message}
            </p>
          </div>
          <button type="submit" className="button">
            Review {kind === "enquiries" ? "enquiry" : "complaint"}
          </button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => setProposal(null)}
          onSuccess={() => {}}
        />
      )}
    </section>
  );
}
