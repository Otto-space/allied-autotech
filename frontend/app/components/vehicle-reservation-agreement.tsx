"use client";
import { useEffect, useRef, useState } from "react";
import { SESSION_CHANGED } from "@/lib/api/client";
import {
  confirmReservation,
  type ReservationPurchase,
} from "@/lib/api/reservation-actions";
import {
  parseReservationTerms,
  readReservationRetry,
  type ReservationRecovery,
  type TermsDocument,
} from "@/lib/api/reservation-terms";
import { useResource } from "@/lib/api/use-resource";
import { formatBusinessDate } from "@/lib/format/date";
import { formatKobo } from "@/lib/format/money";
import { useAccountSession } from "./dashboard-shell";
import { Feedback } from "./feedback";
import { MutationReview, type MutationProposal } from "./mutation-review";
import "./reservation-terms.css";

function AgreementDocument({ document }: { document: TermsDocument }) {
  return (
    <>
      <h3>{document.title}</h3>
      <p>
        Revision {document.revision} · Effective{" "}
        {formatBusinessDate(document.effectiveAt)}
      </p>
      <div
        className="agreement-text"
        role="region"
        aria-label="Reservation agreement text"
        tabIndex={0}
      >
        {document.body}
      </div>
    </>
  );
}
function CustomerAgreement({
  owner,
  record,
  disabled,
  refreshPurchase,
}: {
  owner: string;
  record: ReservationPurchase;
  disabled: boolean;
  refreshPurchase: () => void;
}) {
  const terms = useResource(
    `/customers/vehicle-transactions/${record.id}/reservation-terms`,
    parseReservationTerms,
  );
  const [recovery, setRecovery] = useState<ReservationRecovery>();
  const [storageReady, setStorageReady] = useState(false);
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [acceptedVersion, setAcceptedVersion] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [invalidSession, setInvalidSession] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setRecovery(readReservationRetry(owner, record.id));
        setStorageReady(true);
      }
    });
    const discard = () => {
      pending.current?.abort();
      setProposal(null);
      setRecovery(undefined);
      setAcceptedVersion(undefined);
      setMessage(undefined);
      setInvalidSession(true);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active = false;
      pending.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [owner, record.id]);
  const blocked =
    disabled ||
    invalidSession ||
    terms.loading ||
    terms.refreshing ||
    !!terms.error ||
    !!terms.refreshError ||
    !storageReady ||
    !!proposal;
  const data = !terms.error && !terms.loading ? terms.data : undefined;
  const current = data?.current;
  async function submit(retry = false) {
    const controller = new AbortController();
    pending.current = controller;
    try {
      const result = await confirmReservation({
        owner,
        record,
        document: current ?? undefined,
        retry: retry && recovery?.kind === "pending" ? recovery.intent : undefined,
        signal: controller.signal,
      });
      if (!controller.signal.aborted)
        setMessage(
          result.replayed
            ? "Your original reservation request was confirmed. Check the current purchase status and deadline below."
            : "Your reservation was recorded. Check your purchase status and deadline. No payment was made.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setRecovery(readReservationRetry(owner, record.id));
        setAcceptedVersion(undefined);
        terms.refresh();
      }
      pending.current = null;
    }
  }
  if (invalidSession) return null;
  return (
    <section
      className="detail-section reservation-agreement"
      aria-labelledby="reservation-heading"
    >
      <h2 id="reservation-heading">Reservation agreement</h2>
      <Feedback message={terms.error ?? terms.refreshError} />
      <Feedback message={message} tone="success" />
      {terms.loading && <p role="status">Loading reservation agreement…</p>}
      <button
        className="button secondary"
        disabled={!!proposal || terms.loading || terms.refreshing}
        onClick={() => {
          setAcceptedVersion(undefined);
          setRecovery(readReservationRetry(owner, record.id));
          terms.refresh();
        }}
      >
        Refresh agreement
      </button>
      {data?.accepted && (
        <>
          <p>Accepted {formatBusinessDate(data.accepted.acceptedAt)}.</p>
          <AgreementDocument document={data.accepted.document} />
        </>
      )}
      {data?.legacyAcceptance && (
        <p>
          The earlier acceptance is recorded, but its agreement text is unavailable
          online. Contact customer care for the original document.
        </p>
      )}
      {recovery?.kind === "pending" ? (
        <div className="notice">
          <p>
            A previous reservation request needs confirmation. Check the same request
            before starting another.
          </p>
          <button
            className="button"
            disabled={disabled || !!proposal}
            onClick={() =>
              setProposal({
                title: "Check your original reservation?",
                description:
                  "This checks the original request. It does not accept a newer agreement or extend a recorded deadline.",
                facts: [{ label: "Purchase", value: record.transactionNumber }],
                retryAfterRejection: false,
                submit: () => submit(true),
              })
            }
          >
            Check original reservation
          </button>
        </div>
      ) : recovery ? (
        <p className="notice">
          {recovery.kind === "unavailable"
            ? "Browser storage is unavailable. Enable it and refresh before reserving so an interrupted request can be recovered."
            : "A previous request cannot be safely retried here. Refresh purchase progress and contact customer care to confirm its outcome."}
        </p>
      ) : (
        data &&
        !data.accepted &&
        !data.legacyAcceptance &&
        record.status === "NEGOTIATING" &&
        record.agreedPriceKobo !== null &&
        (current ? (
          <form
            data-no-draft
            onSubmit={(event) => {
              event.preventDefault();
              if (blocked || acceptedVersion !== current.version) return;
              setMessage(undefined);
              setProposal({
                title: "Accept the agreement and reserve this vehicle?",
                description:
                  "Confirm the agreement you reviewed and the agreed price. The server checks availability and sets the reservation deadline. This does not make a payment.",
                facts: [
                  { label: "Vehicle", value: record.vehicleListing.title },
                  { label: "Agreed price", value: formatKobo(record.agreedPriceKobo!) },
                  {
                    label: "Agreement",
                    value: `${current.title} · Revision ${current.revision}`,
                  },
                ],
                retryAfterRejection: false,
                submit: () => submit(),
              });
            }}
          >
            <fieldset disabled={blocked}>
              <AgreementDocument document={current} />
              <label className="check-row">
                <input
                  data-no-draft
                  type="checkbox"
                  required
                  checked={acceptedVersion === current.version}
                  onChange={(event) =>
                    setAcceptedVersion(event.target.checked ? current.version : undefined)
                  }
                />{" "}
                I have read and accept this reservation agreement.
              </label>
              <button
                className="button"
                disabled={blocked || acceptedVersion !== current.version}
              >
                Review reservation
              </button>
            </fieldset>
          </form>
        ) : (
          <div className="notice">
            <h3>Reservation terms are not available online</h3>
            <p>
              Contact our team to review the approved terms before reserving this vehicle.
              Contacting us does not reserve or extend a hold.
            </p>
          </div>
        ))
      )}
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel={
            recovery?.kind === "pending" ? "Check original request" : "Accept and reserve"
          }
          onClose={() => {
            setProposal(null);
            setAcceptedVersion(undefined);
            refreshPurchase();
          }}
          onSuccess={() => {}}
        />
      )}
    </section>
  );
}
export function VehicleReservationAgreement(props: {
  record: ReservationPurchase;
  disabled: boolean;
  refreshPurchase: () => void;
}) {
  const session = useAccountSession();
  return session?.user.role === "CUSTOMER" ? (
    <CustomerAgreement
      key={`${session.user.id}:${props.record.id}`}
      owner={session.user.id}
      {...props}
    />
  ) : null;
}
