"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useAccountMutation } from "@/lib/api/use-account-mutation";
import { parseProfile } from "@/lib/api/profile-schemas";
import { parseCustomerVehicles, type CustomerVehicle } from "@/lib/api/vehicle-schemas";
import { Feedback } from "./feedback";

const identitySchema = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
});
const vehicleLabel = (vehicle: CustomerVehicle) =>
  `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.registrationNumber ? ` · ${vehicle.registrationNumber}` : ""}`;
const readError = (error: unknown) =>
  error instanceof ApiError
    ? error.message
    : "We could not read these account details. Please try again.";

export function BookingAccountDetails({
  serviceId,
  vehicle,
  onVehicleChange,
  disabled,
}: {
  serviceId: string;
  vehicle: CustomerVehicle | null;
  onVehicleChange: (vehicle: CustomerVehicle | null) => void;
  disabled: boolean;
}) {
  const [profile, setProfile] = useState<ReturnType<typeof parseProfile>>();
  const [vehicles, setVehicles] = useState<ReturnType<typeof parseCustomerVehicles>>();
  const [cursor, setCursor] = useState<string>();
  const [error, setError] = useState<string>();
  const [vehicleError, setVehicleError] = useState<string>();
  const [anonymous, setAnonymous] = useState(false);
  const reset = useCallback(() => {
    setProfile(undefined);
    setVehicles(undefined);
    setCursor(undefined);
    setError(undefined);
    setVehicleError(undefined);
    setAnonymous(false);
    onVehicleChange(null);
  }, [onVehicleChange]);
  const operation = useAccountMutation(reset);
  async function load(nextCursor?: string) {
    if (disabled) return;
    const controller = operation.begin();
    if (!controller) return;
    setError(undefined);
    setVehicleError(undefined);
    setAnonymous(false);
    try {
      const session = await apiRequest("/auth/session", {
        optionalSession: true,
        signal: controller.signal,
      });
      const identity = identitySchema.parse(session.data);
      if (identity.user.role !== "CUSTOMER") {
        reset();
        setError(
          "Booking requests use a customer account. Sign in to the customer account you want to book for.",
        );
        return;
      }
      const results = await Promise.allSettled([
        apiRequest("/customers/profile", { signal: controller.signal }).then((result) => {
          const value = parseProfile(result.data);
          if (value.user.id !== identity.user.id)
            throw new Error("Unexpected contact identity");
          return value;
        }),
        apiRequest(
          `/customers/vehicles?limit=20${nextCursor ? `&cursor=${encodeURIComponent(nextCursor)}` : ""}`,
          { signal: controller.signal },
        ).then((result) => parseCustomerVehicles(result.data)),
      ]);
      if (controller.signal.aborted) return;
      const [contact, saved] = results;
      if (contact.status === "fulfilled") setProfile(contact.value);
      else {
        setProfile(undefined);
        setError(readError(contact.reason));
      }
      if (saved.status === "fulfilled") {
        setVehicles(saved.value);
        setCursor(nextCursor);
      } else {
        setVehicles(undefined);
        setVehicleError(readError(saved.reason));
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      reset();
      if (failure instanceof ApiError && failure.status === 401) setAnonymous(true);
      else setError(readError(failure));
    } finally {
      operation.finish(controller);
    }
  }
  return (
    <section className="detail-section" aria-labelledby="booking-account-title">
      <h3 id="booking-account-title">Your vehicle & contact details</h3>
      <p>
        Use a saved vehicle or describe it in the notes below. Your request uses the
        contact details in your customer account.
      </p>
      <button
        type="button"
        className="button secondary"
        disabled={disabled || operation.busy}
        onClick={() => void load()}
      >
        {operation.busy
          ? "Loading account details…"
          : profile || vehicles
            ? "Refresh vehicle & contact details"
            : "Load saved vehicles & contact details"}
      </button>
      <Feedback message={error} />
      {anonymous && (
        <p className="notice">
          Sign in to review your saved details.{" "}
          <Link
            className="text-link"
            href={`/login?next=${encodeURIComponent(`/services/${serviceId}`)}`}
          >
            Sign in to your account
          </Link>
        </p>
      )}
      {profile && (
        <>
          <dl className="totals">
            <dt>Contact</dt>
            <dd>
              {profile.firstName} {profile.lastName}
            </dd>
            <dt>Email</dt>
            <dd>{profile.user.email}</dd>
            <dt>Phone</dt>
            <dd>{profile.phone}</dd>
          </dl>
          <Link
            className="text-link"
            href="/dashboard/profile"
            target="_blank"
            rel="noopener noreferrer"
          >
            Update contact details (new tab)
          </Link>
        </>
      )}
      <Feedback message={vehicleError} />
      {vehicleError && (
        <button
          type="button"
          className="button secondary"
          disabled={disabled || operation.busy}
          onClick={() => void load(cursor)}
        >
          Retry saved vehicles
        </button>
      )}
      {vehicles && (
        <>
          <div className="field">
            <label htmlFor="booking-vehicle">Saved vehicle (optional)</label>
            <select
              id="booking-vehicle"
              value={vehicle?.id ?? ""}
              disabled={disabled || operation.busy}
              onChange={(event) =>
                onVehicleChange(
                  vehicles.items.find((item) => item.id === event.target.value) ?? null,
                )
              }
            >
              <option value="">Describe my vehicle in the notes</option>
              {vehicle && !vehicles.items.some((item) => item.id === vehicle.id) && (
                <option value={vehicle.id}>{vehicleLabel(vehicle)} (selected)</option>
              )}
              {vehicles.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {vehicleLabel(item)}
                </option>
              ))}
            </select>
          </div>
          {vehicles.items.length === 0 && (
            <p>
              No saved vehicles on this page. Add a vehicle to your account or describe it
              in the booking notes.
            </p>
          )}
          <div className="actions">
            {cursor && (
              <button
                type="button"
                className="button secondary"
                disabled={disabled || operation.busy}
                onClick={() => void load()}
              >
                First vehicle page
              </button>
            )}
            {vehicles.nextCursor && (
              <button
                type="button"
                className="button secondary"
                disabled={disabled || operation.busy}
                onClick={() => void load(vehicles.nextCursor)}
              >
                More saved vehicles
              </button>
            )}
            <Link
              className="text-link"
              href="/dashboard/vehicles"
              target="_blank"
              rel="noopener noreferrer"
            >
              Manage saved vehicles (new tab)
            </Link>
          </div>
        </>
      )}
      {vehicle && (
        <p>
          Selected vehicle: <strong>{vehicleLabel(vehicle)}</strong>
        </p>
      )}
    </section>
  );
}
