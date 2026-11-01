"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { parseSupportPage } from "@/lib/api/support-schemas";
import { parseProfile } from "@/lib/api/profile-schemas";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { useSupportCreateWrite } from "@/lib/support/use-support-create-write";
import { SupportCreationRecovery } from "./support-creation-recovery";
import { Feedback } from "./feedback";
import { Check } from "lucide-react";
import type { SupportKind } from "@/lib/api/support-schemas";
import { SupportCreateForm } from "./support-create-form";
import { catalogueOnly } from "@/lib/public-launch";
import { PublicEnquiryActions } from "./public-enquiry-actions";

export function PublicEnquiryForm(props: Parameters<typeof EnabledPublicEnquiryForm>[0]) {
  if (catalogueOnly())
    return (
      <section
        aria-labelledby={props.labelledBy}
        aria-label={props.labelledBy ? undefined : "Contact our team"}
      >
        {!props.labelledBy && <h3>Speak with our team</h3>}
        <p>
          Contact us by email or WhatsApp to discuss your vehicle, a service or a product.
        </p>
        {props.initialMessage && (
          <p className="parts-enquiry-message">{props.initialMessage}</p>
        )}
        <PublicEnquiryActions
          subject={props.initialSubject || props.serviceName || "an enquiry"}
          message={props.initialMessage}
        />
      </section>
    );
  return <AccountAwareEnquiry {...props} />;
}

function AccountAwareEnquiry(props: Parameters<typeof EnabledPublicEnquiryForm>[0]) {
  const [owner, setOwner] = useState<string | null>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest("/auth/session", { optionalSession: true, signal: controller.signal })
      .then((response) => {
        const session = z
          .object({
            user: z.object({ id: z.uuid(), role: z.string() }),
            mfaRequired: z.boolean().optional(),
            mfaVerifiedAt: z.string().nullable().optional(),
          })
          .parse(response.data);
        if (controller.signal.aborted) return;
        if (session.mfaRequired && !session.mfaVerifiedAt)
          throw Error("Security check required");
        setDraftIdentity(`${session.user.id}:${session.user.role}`);
        setOwner(session.user.role === "CUSTOMER" ? session.user.id : null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) {
          setOwner(null);
          setDraftIdentity(null);
        } else setFailed(true);
      });
    const changed = () => {
      controller.abort();
      setOwner(undefined);
      setFailed(false);
      setRevision((value) => value + 1);
    };
    window.addEventListener(SESSION_CHANGED, changed);
    return () => {
      controller.abort();
      window.removeEventListener(SESSION_CHANGED, changed);
    };
  }, [revision]);
  if (owner === undefined)
    return failed ? (
      <div role="status">
        <p>We could not check your account. Your request has not been sent.</p>
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setFailed(false);
            setRevision((v) => v + 1);
          }}
        >
          Retry account check
        </button>
      </div>
    ) : (
      <p role="status">Preparing your request...</p>
    );
  return (
    <EnabledPublicEnquiryForm
      key={owner ?? "guest"}
      {...props}
      owner={owner ?? undefined}
    />
  );
}

function ContextualSupportForm({
  owner,
  ...props
}: Parameters<typeof SupportCreateForm>[0] & { owner?: string }) {
  return owner ? (
    <AuthenticatedContextForm key={`${owner}:${props.kind}`} owner={owner} {...props} />
  ) : (
    <SupportCreateForm {...props} />
  );
}
function AuthenticatedContextForm({
  owner,
  ...props
}: Parameters<typeof SupportCreateForm>[0] & { owner: string }) {
  const parse = useCallback(
    (value: unknown) => parseSupportPage(props.kind, false, value),
    [props.kind],
  );
  const records = useResource(`/customers/support/${props.kind}?limit=20`, parse);
  const profile = useResource("/customers/profile", parseProfile);
  const guard = useSupportCreateWrite(owner, props.kind, records);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saved, setSaved] = useState<string>();
  const successHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!saved) return;
    successHeading.current?.focus({ preventScroll: true });
    successHeading.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [saved]);
  if (saved)
    return (
      <section role="status">
        <h2 ref={successHeading} tabIndex={-1}>
          Request received
        </h2>
        <p>
          Your request is saved in Customer Care. It does not confirm an appointment,
          price or payment.
        </p>
        <Link className="button" href={`/dashboard/support/${props.kind}/${saved}`}>
          Open your request
        </Link>
      </section>
    );
  return (
    <>
      {profile.data?.user.id === owner && (
        <p>
          Sending as {profile.data.firstName} {profile.data.lastName} (
          {profile.data.user.email}).{" "}
          <Link href="/dashboard/profile">Update account contact details</Link>
        </p>
      )}
      <Feedback message={records.error || records.refreshError || guard.storageError} />
      {(records.error || records.refreshError) && (
        <button type="button" className="button secondary" onClick={records.refresh}>
          Retry your records
        </button>
      )}
      <SupportCreationRecovery
        guard={guard}
        kind={props.kind}
        disabled={reviewOpen}
        onReviewChange={setReviewOpen}
        onRecovered={setSaved}
      />
      <SupportCreateForm
        {...props}
        publicMode={false}
        userId={owner}
        guard={guard}
        locked={props.locked || guard.pending}
        onReviewChange={setReviewOpen}
        onSaved={setSaved}
      />
    </>
  );
}

function EnabledPublicEnquiryForm({
  owner,
  serviceId,
  serviceName,
  serviceCategoryId,
  serviceCategoryName,
  submissionLocked = false,
  onSubmissionUncertain,
  presentation,
  labelledBy,
  productId,
  productName,
  initialSubject,
  initialMessage,
  initialContextKey,
  initialEnquiryType,
  initialVehicleEnquiryIntent,
  vehicleListingId,
  vehicleListingTitle,
}: {
  owner?: string;
  serviceId?: string;
  serviceName?: string;
  serviceCategoryId?: string;
  serviceCategoryName?: string;
  productId?: string;
  productName?: string;
  initialSubject?: string;
  initialMessage?: string;
  initialContextKey?: string;
  initialEnquiryType?: "PRODUCT" | "VEHICLE";
  initialVehicleEnquiryIntent?: "LISTING" | "REQUIREMENTS";
  vehicleListingId?: string;
  vehicleListingTitle?: string;
  submissionLocked?: boolean;
  onSubmissionUncertain?: () => void;
  presentation?: "contact";
  labelledBy?: string;
}) {
  const [kind, setKind] = useState<SupportKind>("enquiries");
  const [locked, setLocked] = useState<SupportKind[]>([]);
  return (
    <>
      {!serviceId && !serviceCategoryId && (
        <form
          data-draft-key="public-enquiry-kind"
          onSubmit={(event) => event.preventDefault()}
        >
          {presentation === "contact" ? (
            <fieldset className="contact-reason">
              <legend>Contact reason</legend>
              {(["enquiries", "complaints"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="contact-reason"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                  />
                  <span>
                    <Check size={15} aria-hidden="true" />
                    {value === "enquiries" ? "Enquiry" : "Complaint"}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            !serviceId &&
            !serviceCategoryId && (
              <div className="field">
                <label htmlFor="public-support-kind">Contact reason</label>
                <select
                  id="public-support-kind"
                  value={kind}
                  onChange={(event) =>
                    setKind(
                      event.target.value === "complaints" ? "complaints" : "enquiries",
                    )
                  }
                >
                  <option value="enquiries">Enquiry</option>
                  <option value="complaints">Complaint</option>
                </select>
              </div>
            )
          )}
        </form>
      )}
      <ContextualSupportForm
        owner={owner}
        key={kind}
        kind={kind}
        publicMode
        locked={submissionLocked || locked.includes(kind)}
        onUncertain={() => {
          setLocked((values) => (values.includes(kind) ? values : [...values, kind]));
          onSubmissionUncertain?.();
        }}
        onSaved={() => {}}
        serviceId={serviceId}
        serviceName={serviceName}
        serviceCategoryId={serviceCategoryId}
        serviceCategoryName={serviceCategoryName}
        presentation={presentation}
        labelledBy={labelledBy}
        productId={productId}
        productName={productName}
        initialSubject={initialSubject}
        initialMessage={initialMessage}
        initialEnquiryType={initialEnquiryType}
        initialVehicleEnquiryIntent={initialVehicleEnquiryIntent}
        vehicleListingId={vehicleListingId}
        vehicleListingTitle={vehicleListingTitle}
        initialContextKey={initialContextKey}
      />
    </>
  );
}
