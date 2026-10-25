"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { PartCard, VehicleCard } from "../components/catalogue-cards";
import { parseProducts } from "@/lib/api/commerce-schemas";
import { parseListings } from "@/lib/api/vehicle-schemas";
import {
  demoProducts,
  demoListings,
  demoServices,
  demoCategories,
  demoMakes,
  demoModels,
} from "@/lib/demo/catalogue.mjs";
import { formatKobo } from "@/lib/format/money";
import { vehicleLabel } from "@/lib/vehicle-discovery";
import { containDialogFocus } from "@/lib/dialog-focus";

// Same public schemas and card renderers as genuine inventory; no network or mutation capability.
const products = parseProducts({ items: demoProducts }).items;
const vehicles = parseListings({ items: demoListings }).items;
export function DemoCatalogue() {
  const [surface, setSurface] = useState("parts");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [selection, setSelection] = useState<{
    name: string;
    description: string;
    price: string;
    facts: string[];
  }>();
  const modal = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const matchingParts = products.filter(
    (item) =>
      (!category || item.category.id === category) &&
      `${item.name} ${item.sku} ${item.brand ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const matchingVehicles = vehicles.filter(
    (item) =>
      (!condition || item.vehicle.condition === condition) &&
      item.title.toLowerCase().includes(search.toLowerCase()),
  );
  function inspect(event: React.MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>("a");
    const id = anchor?.getAttribute("href")?.replace("#sample-", "");
    if (!id || !anchor) return;
    const part = products.find((item) => item.id === id);
    const vehicle = vehicles.find((item) => item.id === id);
    if (!part && !vehicle) return;
    event.preventDefault();
    opener.current = anchor;
    setSelection(
      part
        ? {
            name: part.name,
            description: part.description ?? "",
            price: part.priceKobo,
            facts: [
              part.sku,
              part.manufacturerPartNumber ?? "Part number not supplied",
              part.category.name,
              "Compatibility unknown. No sample configuration is verified.",
            ],
          }
        : {
            name: vehicle!.title,
            description: vehicle!.description ?? "",
            price: vehicle!.priceKobo,
            facts: [
              String(vehicle!.vehicle.year),
              vehicleLabel(vehicle!.vehicle.condition),
              vehicle!.vehicle.mileageKm === null
                ? "Mileage not supplied"
                : `${vehicle!.vehicle.mileageKm.toLocaleString("en-NG")} km`,
              "No condition report or inspection is claimed.",
            ],
          },
    );
    modal.current?.showModal();
  }
  return (
    <main
      id="main"
      className={`public-site demo-page ${surface === "vehicles" ? "vehicles-page" : "shop-page"}`}
    >
      <div className="public-wrap demo-wrap">
        <h1>Explore a populated demo catalogue</h1>
        <aside className="demo-notice" id="demo-notice" aria-label="Demo data notice">
          <strong>Fictional examples — not available stock.</strong>
          <p>
            These 20 products/parts, 12 vehicles and 4 services let you explore populated
            layouts. Names, prices, stock and service scope are examples. Nothing here can
            be ordered, reserved or submitted as an enquiry. This preview does not create
            or change business records.
          </p>
          <p>
            Real availability: <Link href="/parts">Parts</Link> ·{" "}
            <Link href="/vehicles">Vehicles</Link> ·{" "}
            <Link href="/services">Services</Link>
          </p>
        </aside>
        <div className="parts-intent" role="group" aria-label="Demo catalogue section">
          {[
            ["parts", "20 products and parts"],
            ["vehicles", "12 vehicles"],
            ["services", "4 services"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={surface === key}
              onClick={() => {
                setSurface(key);
                setSearch("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p>
          Supporting demo data: {demoCategories.length} categories, {demoMakes.length}{" "}
          makes and {demoModels.length} models. No fictional customer reviews, staff
          accounts or financial records are published here.
        </p>
        <section aria-labelledby="demo-results-title">
          <h2 id="demo-results-title">
            {surface === "parts"
              ? "Sample parts"
              : surface === "vehicles"
                ? "Sample vehicles"
                : "Sample services"}
          </h2>
          {surface !== "services" && (
            <div className="demo-filters">
              <div className="field">
                <label htmlFor="demo-search">Search demo {surface}</label>
                <input
                  id="demo-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              {surface === "parts" ? (
                <div className="field">
                  <label htmlFor="demo-category">Demo category</label>
                  <select
                    id="demo-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    <option value="">All categories</option>
                    {demoCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="field">
                  <label htmlFor="demo-condition">Demo condition</label>
                  <select
                    id="demo-condition"
                    value={condition}
                    onChange={(event) => setCondition(event.target.value)}
                  >
                    <option value="">All conditions</option>
                    {["NEW", "FOREIGN_USED", "LOCALLY_USED", "USED"].map((value) => (
                      <option key={value} value={value}>
                        {vehicleLabel(value)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                  setCondition("");
                }}
              >
                Clear demo filters
              </button>
            </div>
          )}
          <p role="status">
            {surface === "parts"
              ? matchingParts.length
              : surface === "vehicles"
                ? matchingVehicles.length
                : demoServices.length}{" "}
            fictional examples shown
          </p>
          <div
            onClickCapture={inspect}
            className={
              surface === "parts"
                ? "product-results-grid"
                : surface === "vehicles"
                  ? "vehicle-results-grid"
                  : "demo-services"
            }
          >
            {surface === "parts" &&
              matchingParts.map((product) => (
                <PartCard
                  key={product.id}
                  product={product}
                  demo
                  href={`#sample-${product.id}`}
                />
              ))}
            {surface === "vehicles" &&
              matchingVehicles.map((listing) => (
                <VehicleCard
                  key={listing.id}
                  listing={listing}
                  demo
                  href={`#sample-${listing.id}`}
                />
              ))}
            {surface === "services" &&
              demoServices.map((service) => (
                <article key={service.id}>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <p>
                    Illustrative quotation basis. No service, price or appointment is
                    offered.
                  </p>
                </article>
              ))}
          </div>
          {((surface === "parts" && !matchingParts.length) ||
            (surface === "vehicles" && !matchingVehicles.length)) && (
            <p>No demo examples match. Clear the demo filters to see all examples.</p>
          )}
        </section>
        <dialog
          ref={modal}
          aria-labelledby="sample-title"
          onKeyDown={containDialogFocus}
          onClose={() => {
            setSelection(undefined);
            opener.current?.focus();
          }}
        >
          <div className="demo-detail">
            <button
              type="button"
              className="button secondary"
              onClick={() => modal.current?.close()}
            >
              Close sample details
            </button>
            <h2 id="sample-title">{selection?.name}</h2>
            <p>
              <strong>Fictional sample. Not for sale.</strong>
            </p>
            <p>{selection?.description}</p>
            {selection && <p>Illustrative price: {formatKobo(selection.price)}</p>}
            <ul>
              {selection?.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
            <p>
              No order, enquiry, payment or inspection can be created for this sample.
            </p>
          </div>
        </dialog>
      </div>
    </main>
  );
}
