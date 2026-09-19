"use client";
import { useState } from "react";
import type { SupportKind } from "@/lib/api/support-schemas";
import { SupportCreateForm } from "./support-create-form";
export function PublicEnquiryForm({
  serviceId,
  serviceName,
  submissionLocked = false,
  onSubmissionUncertain,
}: {
  serviceId?: string;
  serviceName?: string;
  submissionLocked?: boolean;
  onSubmissionUncertain?: () => void;
}) {
  const [kind, setKind] = useState<SupportKind>("enquiries");
  const [locked, setLocked] = useState<SupportKind[]>([]);
  return (
    <>
      {!serviceId && (
        <div className="field">
          <label htmlFor="public-support-kind">Contact reason</label>
          <select
            id="public-support-kind"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value === "complaints" ? "complaints" : "enquiries")
            }
          >
            <option value="enquiries">Enquiry</option>
            <option value="complaints">Complaint</option>
          </select>
        </div>
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
      />
    </>
  );
}
