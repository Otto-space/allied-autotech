"use client";
import Link from "next/link";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { Feedback } from "./feedback";
export function VehicleActions({ listingId }: { listingId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [login, setLogin] = useState(false);
  async function submit(action: "save" | "enquire" | "inspect", form?: FormData) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      if (action === "save")
        await apiRequest(`/customers/saved-vehicles/${listingId}`, {
          method: "PUT",
          csrf: true,
          body: {},
        });
      else if (action === "enquire") {
        const body: RequestBody<"/customers/vehicle-transactions", "post"> = {
          vehicleListingId: listingId,
        };
        await apiRequest("/customers/vehicle-transactions", {
          method: "POST",
          csrf: true,
          body,
        });
      } else {
        const preferredStartAt = String(form?.get("preferredStartAt"));
        const notes = String(form?.get("notes") ?? "").trim();
        const localDate = new Date(`${preferredStartAt}:00+01:00`);
        if (!Number.isFinite(localDate.getTime()) || localDate.getTime() <= Date.now()) {
          setError("Choose a future date and time in Lagos time.");
          return;
        }
        const body: RequestBody<"/customers/vehicle-inspections", "post"> = {
          vehicleListingId: listingId,
          preferredStartAt: localDate.toISOString(),
          ...(notes ? { notes } : {}),
        };
        await apiRequest("/customers/vehicle-inspections", {
          method: "POST",
          csrf: true,
          body,
        });
      }
      setMessage(
        action === "save"
          ? "Vehicle saved to your account."
          : action === "inspect"
            ? "Inspection requested. The requested time is not confirmed yet; check your account for the agreed appointment."
            : "Your vehicle enquiry has been created. Check your account for updates from our team.",
      );
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm your request. Check your account before submitting again.",
      );
      setLogin(value instanceof ApiError && value.status === 401);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Feedback message={error} />
      <Feedback message={message} tone="success" />
      {login && (
        <p>
          <Link
            className="button"
            href={`/login?next=${encodeURIComponent(`/vehicles/${listingId}`)}`}
          >
            Sign in to continue
          </Link>
        </p>
      )}
      <div className="actions">
        <button className="button" disabled={busy} onClick={() => void submit("enquire")}>
          Enquire about this vehicle
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void submit("save")}
        >
          Save vehicle
        </button>
      </div>
      <section className="detail-section">
        <h2>Request an inspection</h2>
        <p className="muted">
          Tell us when you would like to visit. Your appointment is confirmed separately.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit("inspect", new FormData(event.currentTarget));
          }}
        >
          <div className="field">
            <label htmlFor="inspection-start">Preferred date and time (Lagos time)</label>
            <input
              id="inspection-start"
              name="preferredStartAt"
              type="datetime-local"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="inspection-notes">Notes (optional)</label>
            <textarea id="inspection-notes" name="notes" maxLength={2000} />
          </div>
          <button className="button" disabled={busy}>
            {busy ? "Submitting…" : "Request inspection"}
          </button>
        </form>
      </section>
    </>
  );
}
