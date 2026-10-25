"use client";
import { useState } from "react";
import type { SupportKind } from "@/lib/api/support-schemas";
import { SupportCreateForm } from "./support-create-form";
import { catalogueOnly } from "@/lib/public-launch";
import { PublicEnquiryActions } from "./public-enquiry-actions";

export function PublicEnquiryForm(props: Parameters<typeof EnabledPublicEnquiryForm>[0]) {
  if (catalogueOnly())
    return (
      <section aria-label="Contact our team">
        <h3>Speak with our team</h3>
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
  return <EnabledPublicEnquiryForm {...props} />;
}

function EnabledPublicEnquiryForm({
  serviceId,
  serviceName,
  submissionLocked = false,
  onSubmissionUncertain,
  presentation,
  productId,
  productName,
  initialSubject,
  initialMessage,
  initialContextKey,
  initialEnquiryType,
}: {
  serviceId?: string;
  serviceName?: string;
  productId?: string;
  productName?: string;
  initialSubject?: string;
  initialMessage?: string;
  initialContextKey?: string;
  initialEnquiryType?: "PRODUCT";
  submissionLocked?: boolean;
  onSubmissionUncertain?: () => void;
  presentation?: "contact";
}) {
  const [kind, setKind] = useState<SupportKind>("enquiries");
  const [locked, setLocked] = useState<SupportKind[]>([]);
  return (
    <>
      {!serviceId && (
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
                  <span>{value === "enquiries" ? "Enquiry" : "Complaint"}</span>
                </label>
              ))}
            </fieldset>
          ) : (
            !serviceId && (
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
      <SupportCreateForm
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
        presentation={presentation}
        productId={productId}
        productName={productName}
        initialSubject={initialSubject}
        initialMessage={initialMessage}
        initialEnquiryType={initialEnquiryType}
        initialContextKey={initialContextKey}
      />
    </>
  );
}
