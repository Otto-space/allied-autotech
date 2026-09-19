"use client";
import type { StaffVehicle } from "@/lib/api/staff-vehicle-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { PublicMedia } from "./public-media";
import { PrivateDocumentAccess } from "./private-document-access";
import { VehicleAttachmentForm } from "./vehicle-attachment-form";
import { VehicleDocumentReview } from "./vehicle-document-review";
import { VehicleConditionForm } from "./vehicle-condition-form";
import type { MutationProposal } from "./mutation-review";

export function VehicleEvidence({
  vehicle,
  disabled,
  onReview,
}: {
  vehicle: StaffVehicle;
  disabled: boolean;
  onReview: (proposal: MutationProposal) => void;
}) {
  const publicImages =
    vehicle.branch.isActive &&
    vehicle.listings.some((listing) => listing.status === "AVAILABLE");
  return (
    <>
      <section className="detail-section" aria-labelledby="vehicle-photos-heading">
        <h2 id="vehicle-photos-heading">Vehicle photos</h2>
        <p>
          Photos are shared across this vehicle’s public listings. Only upload approved
          public images.
        </p>
        {!vehicle.images.length && <p>No photos have been attached.</p>}
        <div className="record-grid">
          {vehicle.images.map((photo) => (
            <figure className="vehicle-photo" key={photo.id}>
              {publicImages ? (
                <PublicMedia
                  src={photo.url}
                  alt={photo.altText ?? `${vehicle.make} ${vehicle.model}`}
                />
              ) : (
                <p className="notice">
                  Preview becomes available with an available listing at an active branch.
                </p>
              )}
              <figcaption>
                {photo.altText ?? "No photo description recorded"}
                <span className="muted">
                  {" "}
                  — order {photo.sortOrder}
                  {photo.isPrimary ? " · Primary photo" : ""}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
        <details>
          <summary>Add a vehicle photo</summary>
          <VehicleAttachmentForm
            key={`image-${vehicle.images.map((image) => image.id).join(",")}`}
            vehicleId={vehicle.id}
            kind="IMAGE"
            disabled={disabled}
            onReview={onReview}
          />
        </details>
      </section>
      <section className="detail-section" aria-labelledby="vehicle-documents-heading">
        <h2 id="vehicle-documents-heading">Private vehicle documents</h2>
        <p>
          Documents are private. File attachment, document assessment and temporary
          download access are separate actions.
        </p>
        {!vehicle.documents.length && <p>No private documents have been attached.</p>}
        {vehicle.documents.map((document) => (
          <section
            className="detail-section"
            key={document.id}
            aria-labelledby={`document-heading-${document.id}`}
          >
            <h3 id={`document-heading-${document.id}`}>
              {document.type.replaceAll("_", " ")}
            </h3>
            <p className="status">{document.verificationStatus}</p>
            <dl className="totals">
              <dt>Attached</dt>
              <dd>{formatBusinessDate(document.createdAt)}</dd>
              <dt>File</dt>
              <dd>
                {document.mimeType ?? "Type not recorded"}
                {` · ${BigInt(document.sizeBytes).toLocaleString("en-NG")} bytes`}
              </dd>
              <dt>Issued</dt>
              <dd>
                {document.issuedAt
                  ? formatBusinessDate(document.issuedAt)
                  : "Not recorded"}
              </dd>
              <dt>Expires</dt>
              <dd>
                {document.expiresAt
                  ? formatBusinessDate(document.expiresAt)
                  : "Not recorded"}
              </dd>
              {document.verifiedAt && (
                <>
                  <dt>Verified</dt>
                  <dd>{formatBusinessDate(document.verifiedAt)}</dd>
                </>
              )}
              {document.rejectionReason && (
                <>
                  <dt>Rejection reason</dt>
                  <dd>{document.rejectionReason}</dd>
                </>
              )}
            </dl>
            <PrivateDocumentAccess
              path={`/staff/vehicles/${vehicle.id}/documents/${document.id}/access`}
              label="vehicle document"
              disabled={disabled}
            />
            <details>
              <summary>Assess this document</summary>
              <VehicleDocumentReview
                vehicleId={vehicle.id}
                document={document}
                disabled={disabled}
                onReview={onReview}
              />
            </details>
          </section>
        ))}
        <details>
          <summary>Add a private document</summary>
          <VehicleAttachmentForm
            key={`document-${vehicle.documents.map((document) => document.id).join(",")}`}
            vehicleId={vehicle.id}
            kind="DOCUMENT"
            disabled={disabled}
            onReview={onReview}
          />
        </details>
      </section>
      <section className="detail-section" aria-labelledby="vehicle-condition-heading">
        <h2 id="vehicle-condition-heading">Latest condition report</h2>
        <p>
          The latest report by inspection time is shown here. Its summary and findings are
          public on available vehicle listings.
        </p>
        {!vehicle.conditionReports.length && (
          <p>No condition report has been recorded.</p>
        )}
        {vehicle.conditionReports.map((report) => (
          <div key={report.id}>
            <p>{formatBusinessDate(report.inspectedAt)}</p>
            <p className="preserve-lines">{report.summary}</p>
            <dl className="totals">
              <dt>Odometer</dt>
              <dd>
                {report.odometerKm === null
                  ? "Not recorded"
                  : `${report.odometerKm.toLocaleString("en-NG")} km`}
              </dd>
              <dt>Condition score</dt>
              <dd>
                {report.conditionScore === null
                  ? "Not recorded"
                  : `${report.conditionScore} / 100`}
              </dd>
              {Object.entries(report.findings ?? {}).map(([name, value]) => (
                <div className="spec-row" key={name}>
                  <dt>{name}</dt>
                  <dd>
                    {value === null
                      ? "Not recorded"
                      : typeof value === "boolean"
                        ? value
                          ? "Yes"
                          : "No"
                        : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <details>
          <summary>Record a condition report</summary>
          <VehicleConditionForm
            vehicle={vehicle}
            disabled={disabled}
            onReview={onReview}
          />
        </details>
      </section>
    </>
  );
}
