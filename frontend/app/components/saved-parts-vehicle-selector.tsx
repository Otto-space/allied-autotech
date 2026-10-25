"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  garagePartsQuery,
  garageVehicleSchema,
  parseGarageVehicles,
} from "@/lib/customer-garage";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
import { catalogueOnly } from "@/lib/public-launch";

const sessionSchema = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
  expiresAt: z.iso.datetime({ offset: true }),
  idleExpiresAt: z.iso.datetime({ offset: true }),
  mfaRequired: z.boolean(),
  mfaVerifiedAt: z.string().nullable(),
});
export function SavedPartsVehicleSelector({
  onUse,
  returnTo = "/parts",
}: {
  onUse: (query: URLSearchParams) => void;
  returnTo?: string;
}) {
  if (catalogueOnly()) return null;
  return <SavedVehicleAccount onUse={onUse} returnTo={returnTo} />;
}
function SavedVehicleAccount({
  onUse,
  returnTo,
}: {
  onUse: (query: URLSearchParams) => void;
  returnTo: string;
}) {
  const [actor, setActor] = useState<string | null>();
  const [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    void apiRequest("/auth/session", { optionalSession: true, signal: controller.signal })
      .then((response) => {
        const session = sessionSchema.parse(response.data);
        if (active && !controller.signal.aborted) {
          const valid =
            Date.parse(session.expiresAt) > Date.now() &&
            Date.parse(session.idleExpiresAt) > Date.now() &&
            (!session.mfaRequired || !!session.mfaVerifiedAt);
          setActor(
            valid ? (session.user.role === "CUSTOMER" ? session.user.id : "staff") : null,
          );
          setFailed(false);
          if (valid)
            expiryTimer = setTimeout(
              () => {
                if (active) setActor(null);
              },
              Math.min(
                2_147_483_647,
                Math.max(
                  1,
                  Math.min(
                    Date.parse(session.expiresAt),
                    Date.parse(session.idleExpiresAt),
                  ) - Date.now(),
                ),
              ),
            );
        }
      })
      .catch((error: unknown) => {
        if (active && !controller.signal.aborted) {
          setActor(null);
          setFailed(!(error instanceof ApiError && error.status === 401));
        }
      });
    const discard = () => {
      active = false;
      controller.abort();
      setActor(undefined);
      setFailed(false);
      setRevision((value) => value + 1);
    };
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active = false;
      controller.abort();
      clearTimeout(expiryTimer);
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, [revision]);
  if (actor === "staff") return null;
  if (actor) return <OwnedVehicleChoices key={actor} onUse={onUse} />;
  if (failed)
    return (
      <p className="parts-saved-vehicles" role="status">
        Saved vehicles could not be checked.{" "}
        <button type="button" onClick={() => setRevision((value) => value + 1)}>
          Retry saved vehicles
        </button>
      </p>
    );
  return actor === null ? (
    <p className="parts-saved-vehicles">
      <Link
        href={`/login?next=${encodeURIComponent(returnTo === "/parts" || returnTo.startsWith("/parts?") ? returnTo : "/parts")}`}
      >
        Sign in to reuse a saved vehicle
      </Link>
      . You can also search with the vehicle details below.
    </p>
  ) : null;
}
function OwnedVehicleChoices({ onUse }: { onUse: (query: URLSearchParams) => void }) {
  const [cursor, setCursor] = useState("");
  const vehicles = useResource(
    `/customers/vehicles?limit=25${cursor ? `&cursor=${cursor}` : ""}`,
    parseGarageVehicles,
  );
  const defaults = useResource(
    "/customers/vehicles?defaultOnly=true&limit=1",
    parseGarageVehicles,
  );
  const [selected, setSelected] = useState<CustomerVehicle>();
  const [selection, setSelection] = useState<string>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const defaultVehicle = defaults.error
    ? undefined
    : defaults.data?.items.find((vehicle) => vehicle.isDefault);
  const options = [
    ...new Map(
      [
        ...(defaultVehicle ? [defaultVehicle] : []),
        ...(selected ? [selected] : []),
        ...(vehicles.data?.items || []),
      ].map((vehicle) => [vehicle.id, vehicle]),
    ).values(),
  ];
  const value = selection ?? defaultVehicle?.id ?? "";
  const choice = options.find((vehicle) => vehicle.id === value);
  const query = choice ? garagePartsQuery(choice) : null;
  const blocked =
    busy ||
    vehicles.loading ||
    vehicles.refreshing ||
    !!vehicles.error ||
    !!vehicles.refreshError;
  async function apply() {
    if (blocked || !choice || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const sourceLocation = window.location.href;
    setBusy(true);
    setMessage("");
    try {
      const fresh = garageVehicleSchema.parse(
        (
          await apiRequest(`/customers/vehicles/${choice.id}`, {
            signal: controller.signal,
          })
        ).data,
      );
      if (controller.signal.aborted) return;
      if (window.location.href !== sourceLocation) {
        setMessage(
          "Your search changed while checking the saved vehicle. Select it again to apply it to the current search.",
        );
        return;
      }
      if (fresh.id !== choice.id) throw Error("Saved vehicle identity changed");
      const currentQuery = garagePartsQuery(fresh);
      if (!currentQuery) {
        setMessage(
          "This vehicle's catalogue configuration changed. Review it in your garage before searching.",
        );
        return;
      }
      setSelected(fresh);
      vehicles.refresh();
      defaults.refresh();
      onUse(currentQuery);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessage(
        "This saved vehicle could not be verified. Refresh your choices or review your garage.",
      );
      if (error instanceof ApiError && error.status === 404) {
        setSelected(undefined);
        setSelection("");
        vehicles.refresh();
        defaults.refresh();
      }
    } finally {
      if (pending.current === controller) pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="parts-saved-vehicles" aria-labelledby="parts-saved-title">
      <h4 id="parts-saved-title">Use a saved vehicle</h4>
      <div className="parts-saved-controls">
        <div className="product-field">
          <label htmlFor="parts-saved-car">Your vehicle configurations</label>
          <select
            id="parts-saved-car"
            value={value}
            disabled={blocked}
            onChange={(event) => {
              setSelection(event.target.value);
              setSelected(options.find((vehicle) => vehicle.id === event.target.value));
              setMessage("");
            }}
          >
            <option value="">Choose a saved vehicle</option>
            {options.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.nickname ? `${vehicle.nickname} · ` : ""}
                {vehicle.year} {vehicle.make} {vehicle.model}
                {vehicle.isDefault && vehicle.id === defaultVehicle?.id
                  ? " (default)"
                  : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={blocked || !query}
          aria-busy={busy}
          onClick={() => void apply()}
        >
          {busy ? "Checking vehicle..." : "Use this vehicle"}
        </button>
        <Link href="/dashboard/vehicles">Manage saved vehicles</Link>
      </div>
      {vehicles.loading && <p role="status">Loading your saved vehicles...</p>}
      {!vehicles.loading && !vehicles.error && !options.length && (
        <p>
          No vehicles are saved yet. Add one in your garage, or enter its details below.
        </p>
      )}
      {choice && !query && (
        <p role="status">
          Review this vehicle&apos;s catalogue model and technical details in your garage
          before using it for parts checks.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {(vehicles.error || vehicles.refreshError) && (
        <p role="alert">
          Your saved vehicles could not be loaded.{" "}
          <button type="button" onClick={vehicles.refresh}>
            Retry vehicle choices
          </button>
        </p>
      )}
      {defaults.error && (
        <p role="status">
          Your default vehicle could not be checked. Choose a vehicle from this page or{" "}
          <button type="button" onClick={defaults.refresh}>
            retry the default
          </button>
          .
        </p>
      )}
      <div className="parts-saved-paging">
        <button
          type="button"
          disabled={busy || vehicles.loading}
          onClick={() => {
            vehicles.refresh();
            defaults.refresh();
          }}
        >
          Refresh saved vehicles
        </button>
        {vehicles.data?.nextCursor && (
          <button
            type="button"
            disabled={blocked}
            onClick={() => setCursor(vehicles.data!.nextCursor!)}
          >
            Next vehicle choices
          </button>
        )}
        {cursor && (
          <button type="button" disabled={blocked} onClick={() => setCursor("")}>
            First vehicle choices
          </button>
        )}
      </div>
    </section>
  );
}
