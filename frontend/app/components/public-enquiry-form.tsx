"use client";
import { useState } from "react";
import { apiRequest, ApiError } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { Feedback } from "./feedback";
export function PublicEnquiryForm({
  serviceId,
  serviceName,
}: {
  serviceId?: string;
  serviceName?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || complete) return;
    setBusy(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const phone = String(form.get("phone") ?? "").trim();
    const common = {
      name: String(form.get("name")).trim(),
      email: String(form.get("email")).trim(),
      subject: serviceName
        ? `Quotation enquiry: ${serviceName}`.slice(0, 160)
        : String(form.get("subject")).trim(),
      message: String(form.get("message")).trim(),
      ...(phone ? { phone } : {}),
    };
    const body: RequestBody<"/public/support/enquiries", "post"> = serviceId
      ? { ...common, type: "SERVICE", serviceId }
      : { ...common, type: "GENERAL" };
    try {
      await apiRequest("/public/support/enquiries", { method: "POST", body });
      setComplete(true);
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm your enquiry. Contact us before submitting it again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (complete)
    return (
      <div className="notice success" role="status">
        <h2>Your enquiry has been received.</h2>
        <p>
          Our team can follow up using the contact details you provided. No appointment or
          price has been confirmed by this enquiry.
        </p>
      </div>
    );
  return (
    <>
      <Feedback message={error} />
      <form onSubmit={submit}>
        <div className="form-row">
          <div className="field">
            <label htmlFor="enquiry-name">Your name</label>
            <input
              id="enquiry-name"
              name="name"
              autoComplete="name"
              required
              maxLength={120}
            />
          </div>
          <div className="field">
            <label htmlFor="enquiry-email">Email address</label>
            <input
              id="enquiry-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </div>
        </div>
        <div className="field">
          <label htmlFor="enquiry-phone">Phone number (optional)</label>
          <input
            id="enquiry-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            minLength={7}
            maxLength={32}
          />
        </div>
        {!serviceId && (
          <div className="field">
            <label htmlFor="enquiry-subject">Subject</label>
            <input id="enquiry-subject" name="subject" required maxLength={160} />
          </div>
        )}
        <div className="field">
          <label htmlFor="enquiry-message">
            {serviceId ? "Tell us about the work you need" : "Your message"}
          </label>
          <textarea
            id="enquiry-message"
            name="message"
            required
            maxLength={4000}
            aria-describedby="enquiry-privacy"
          />
          <span id="enquiry-privacy" className="field-hint">
            Please do not include passwords, card details or private documents.
          </span>
        </div>
        <button className="button" disabled={busy}>
          {busy ? "Sending…" : serviceId ? "Request a quotation" : "Send enquiry"}
        </button>
      </form>
    </>
  );
}
