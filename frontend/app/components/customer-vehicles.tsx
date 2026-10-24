"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CarFront,
  ChevronRight,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import type { CustomerVehicle } from "@/lib/api/vehicle-schemas";
import {
  garagePartsQuery,
  garageQuery,
  parseGarageVehicles,
} from "@/lib/customer-garage";
import { GarageVehicleEditor } from "./garage-vehicle-editor";
import { GarageRemoveDialog } from "./garage-remove-dialog";
import { GaragePhotoCarousel } from "./garage-photo-carousel";
import { Feedback } from "./feedback";

type Dialog =
  | { mode: "edit"; vehicle: CustomerVehicle | null }
  | { mode: "remove"; vehicle: CustomerVehicle };
export function CustomerVehicles() {
  const search = useSearchParams();
  const { params, invalid, path } = garageQuery(new URLSearchParams(search.toString()));
  const cursor = params.get("cursor"),
    trail = params.get("_trail")?.split(",") ?? [];
  const vehicles = useResource(path, parseGarageVehicles);
  const data = !vehicles.loading && !vehicles.error ? vehicles.data : undefined;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState<string>();
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    function discard() {
      setDialog(null);
      setMessage(undefined);
      setUncertain(false);
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => window.removeEventListener(SESSION_CHANGED, discard);
  }, []);
  function navigate(next: URLSearchParams) {
    window.history.pushState(null, "", `/dashboard/vehicles?${garageQuery(next).params}`);
  }
  function firstPage() {
    const next = new URLSearchParams(params);
    next.delete("cursor");
    next.delete("_trail");
    navigate(next);
  }
  function open(next: Dialog) {
    setMessage(undefined);
    setUncertain(false);
    setDialog(next);
  }
  function close() {
    setDialog(null);
    if (uncertain) vehicles.refresh();
  }
  function saved(removed = false) {
    setDialog(null);
    setUncertain(false);
    firstPage();
    vehicles.refresh();
    setMessage(removed ? "Vehicle removed from your account." : "Vehicle details saved.");
  }
  const blocked = !data || vehicles.refreshing || !!vehicles.refreshError;
  return (
    <div className="customer-garage">
      <nav className="garage-breadcrumb" aria-label="Breadcrumb">
        <ol>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">My vehicles</span>
          </li>
        </ol>
      </nav>
      <header className="garage-heading">
        <div>
          <h1>Your vehicles</h1>
          <p>Keep your vehicle details for workshop visits and parts searches.</p>
        </div>
        <div className="garage-heading-actions">
          <button
            className="button secondary"
            disabled={vehicles.loading || vehicles.refreshing}
            onClick={vehicles.refresh}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {vehicles.refreshing ? "Updating..." : "Refresh"}
          </button>
          <button
            id="garage-add"
            className="button"
            disabled={blocked}
            onClick={() => open({ mode: "edit", vehicle: null })}
          >
            <Plus size={16} aria-hidden="true" />
            Add a vehicle
          </button>
        </div>
      </header>
      <aside className="garage-guidance">
        <CarFront size={24} aria-hidden="true" />
        <div>
          <h2>Ready for your next workshop visit</h2>
          <p>Keep your vehicle details up to date. Add photos from Manage photos.</p>
        </div>
      </aside>
      <Feedback
        message={message}
        tone="success"
        toast="Your vehicle records have been updated."
      />
      {uncertain && !dialog && (
        <p role="status" className="garage-notice">
          A previous change could not be confirmed. Check your vehicle records before
          making another change.
        </p>
      )}
      {invalid && (
        <p role="status" className="garage-notice">
          Some invalid page options were ignored.
        </p>
      )}
      {vehicles.refreshError && (
        <div role="status" className="garage-notice">
          We couldn&apos;t update your vehicles. These details may be out of date.{" "}
          <button className="garage-text-action" onClick={vehicles.refresh}>
            Retry vehicles
          </button>
        </div>
      )}
      <div className="garage-toolbar">
        <span role="status">
          {vehicles.loading
            ? "Checking vehicles..."
            : data
              ? `${data.items.length} ${data.items.length === 1 ? "vehicle" : "vehicles"} on this page`
              : "Vehicle records unavailable"}
        </span>
        <div>
          <label htmlFor="garage-limit">Rows per page</label>
          <select
            id="garage-limit"
            value={params.get("limit")!}
            onChange={(e) => navigate(new URLSearchParams({ limit: e.target.value }))}
          >
            {[10, 20, 50].map((n) => (
              <option value={n} key={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>
      {vehicles.loading && (
        <div className="garage-skeleton" aria-label="Loading vehicles" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <div key={n}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      )}
      {vehicles.error && (
        <section className="garage-empty" role="alert">
          <CarFront size={32} aria-hidden="true" />
          <h2>We couldn&apos;t load your vehicles</h2>
          <p>{vehicles.error}</p>
          <button className="button secondary" onClick={vehicles.refresh}>
            Retry vehicles
          </button>
          {cursor && (
            <button className="garage-text-action" onClick={firstPage}>
              First page
            </button>
          )}
        </section>
      )}
      {data && data.items.length === 0 && (
        <section className="garage-empty">
          <CarFront size={32} aria-hidden="true" />
          <h2>{cursor ? "No vehicles on this page" : "Your garage is empty"}</h2>
          <p>
            {cursor
              ? "Return to the first page to check your vehicles."
              : "Add a vehicle to keep its workshop details in one place."}
          </p>
          <button
            className="button secondary"
            onClick={() => (cursor ? firstPage() : open({ mode: "edit", vehicle: null }))}
            disabled={blocked}
          >
            {cursor ? "First page" : "Add your first vehicle"}
          </button>
        </section>
      )}
      {data && data.items.length > 0 && (
        <div className="garage-records">
          {data.items.map((vehicle) => (
            <article
              className="garage-record"
              key={vehicle.id}
              aria-labelledby={`garage-title-${vehicle.id}`}
            >
              <GaragePhotoCarousel
                images={vehicle.images}
                vehicleName={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
              />
              <div className="garage-record-info">
                <h2 id={`garage-title-${vehicle.id}`}>
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </h2>
                {vehicle.nickname && <p>{vehicle.nickname}</p>}
                {vehicle.isDefault && (
                  <p className="garage-default-badge">Default vehicle</p>
                )}
                <dl>
                  {[
                    ["Registration", vehicle.registrationNumber],
                    ["Colour", vehicle.color],
                    [
                      "Mileage",
                      vehicle.mileageKm === null
                        ? null
                        : `${vehicle.mileageKm.toLocaleString("en-NG")} km`,
                    ],
                    ["VIN", vehicle.vin],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className={label === "VIN" ? "garage-vin" : undefined}
                    >
                      <dt>{label}</dt>
                      <dd className={value === null ? "garage-missing" : undefined}>
                        {value ?? "Not provided"}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="garage-record-actions">
                {garagePartsQuery(vehicle) ? (
                  <Link
                    className="button secondary"
                    href={`/parts?${garagePartsQuery(vehicle)}`}
                  >
                    Find parts for this vehicle
                  </Link>
                ) : (
                  <button
                    className="garage-text-action"
                    disabled={blocked}
                    onClick={() => open({ mode: "edit", vehicle })}
                  >
                    Set up parts search
                  </button>
                )}
                <Link
                  className="button secondary"
                  href={`/dashboard/vehicles/${vehicle.id}`}
                  aria-label={`Manage photos for ${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                >
                  <Camera size={16} aria-hidden="true" />
                  Manage photos
                </Link>
                <button
                  className="garage-text-action"
                  disabled={blocked}
                  onClick={() => open({ mode: "edit", vehicle })}
                >
                  <Pencil size={16} aria-hidden="true" />
                  Edit details
                </button>
                <button
                  className="garage-text-action"
                  disabled={blocked}
                  onClick={() => open({ mode: "remove", vehicle })}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {data && (
        <div className="garage-footer">
          <nav className="garage-pagination" aria-label="Your vehicle pages">
            <button
              className="button secondary"
              disabled={!cursor || vehicles.refreshing}
              onClick={() => {
                if (!trail.length) return firstPage();
                const next = new URLSearchParams(params),
                  previous = trail.at(-1)!;
                if (previous === "start") next.delete("cursor");
                else next.set("cursor", previous);
                if (trail.length > 1) next.set("_trail", trail.slice(0, -1).join(","));
                else next.delete("_trail");
                navigate(next);
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {cursor && !trail.length ? "First page" : "Previous"}
            </button>
            <span>
              {cursor && !trail.length ? "Later page" : `Page ${trail.length + 1}`}
            </span>
            <button
              className="button secondary"
              disabled={
                !data.nextCursor || vehicles.refreshing || !!vehicles.refreshError
              }
              onClick={() => {
                if (!data.nextCursor) return;
                const next = new URLSearchParams(params);
                next.set("cursor", data.nextCursor);
                if (!cursor || trail.length)
                  next.set("_trail", [...trail, cursor ?? "start"].join(","));
                else next.delete("_trail");
                navigate(next);
              }}
            >
              Next
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </nav>
          <p>
            Need help with your vehicle?{" "}
            <Link href="/dashboard/support">Contact support</Link>
          </p>
        </div>
      )}
      {dialog?.mode === "edit" && (
        <GarageVehicleEditor
          vehicle={dialog.vehicle}
          onClose={close}
          onSaved={() => saved()}
          onUncertain={() => setUncertain(true)}
        />
      )}
      {dialog?.mode === "remove" && (
        <GarageRemoveDialog
          vehicle={dialog.vehicle}
          onClose={close}
          onRemoved={() => saved(true)}
          onUncertain={() => setUncertain(true)}
        />
      )}
    </div>
  );
}
