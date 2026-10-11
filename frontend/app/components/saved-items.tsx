"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  Bookmark,
  CarFront,
  Heart,
  Info,
  Package,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { z } from "zod";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { productSchema } from "@/lib/api/commerce-schemas";
import { listingSchema } from "@/lib/api/vehicle-schemas";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import { PublicMedia } from "./public-media";
import { CursorPagination, useCursorPage } from "./cursor-pagination";
import { useAccountSession } from "./dashboard-shell";
import { MutationReview, type MutationProposal } from "./mutation-review";
import "./saved-items.css";

const favouritesSchema = z
  .object({
    items: z.array(z.object({ id: z.string().uuid(), product: productSchema })).max(12),
    nextCursor: z.string().uuid().optional(),
  })
  .refine(
    ({ items }) => new Set(items.map((item) => item.product.id)).size === items.length,
    "Duplicate favourites",
  );
const savedVehiclesSchema = z
  .object({
    items: z
      .array(z.object({ id: z.string().uuid(), vehicleListing: listingSchema }))
      .max(12),
    nextCursor: z
      .string()
      .length(101)
      .regex(/^[0-9a-f-]{36}_[0-9a-f]{64}$/)
      .optional(),
  })
  .refine(
    ({ items }) =>
      new Set(items.map((item) => item.vehicleListing.id)).size === items.length,
    "Duplicate saved vehicles",
  );
const parseFavourites = (value: unknown) => favouritesSchema.parse(value);
const parseSavedVehicles = (value: unknown) => savedVehiclesSchema.parse(value);
type Collection = "parts" | "vehicles";
const labels = { parts: "Favourite parts", vehicles: "Saved vehicles" };
const human = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
type SavedCardData = {
  id: string;
  name: string;
  image?: string;
  category?: string;
  identity: string;
  price: string;
  stock?: string;
  specs?: string[];
};

export function SavedItems() {
  const session = useAccountSession();
  return session?.user.role === "CUSTOMER" ? (
    <SavedCollections key={`${session.id}:${session.user.id}`} />
  ) : null;
}

function SavedCollections() {
  const [collection, setCollection] = useState<Collection>("parts");
  const [sessionValid, setSessionValid] = useState(true);
  const pagination = useCursorPage();
  const vehiclePagination = useCursorPage();
  const parts = useResource(
    sessionValid && collection === "parts"
      ? `/customers/favourites?limit=12${pagination.cursor ? `&cursor=${encodeURIComponent(pagination.cursor)}` : ""}`
      : null,
    parseFavourites,
  );
  const vehicles = useResource(
    sessionValid && collection === "vehicles"
      ? `/customers/saved-vehicles/page?limit=12${vehiclePagination.cursor ? `&cursor=${encodeURIComponent(vehiclePagination.cursor)}` : ""}`
      : null,
    parseSavedVehicles,
  );
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [message, setMessage] = useState<string>();
  const active = useRef(true),
    uncertain = useRef(false),
    removed = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterRevision = useRef<number | null>(null);
  const partTab = useRef<HTMLButtonElement>(null),
    vehicleTab = useRef<HTMLButtonElement>(null);
  const resource = collection === "parts" ? parts : vehicles;
  const stale =
    resource.loading ||
    resource.refreshing ||
    !!resource.error ||
    !!resource.refreshError ||
    !sessionValid;
  useEffect(() => {
    if (
      proposal ||
      focusAfterRevision.current === null ||
      resource.settledRevision === null ||
      resource.settledRevision < focusAfterRevision.current
    )
      return;
    focusAfterRevision.current = null;
    const frame = requestAnimationFrame(() => {
      if (active.current) heading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [proposal, resource.settledRevision]);
  useEffect(() => {
    active.current = true;
    function discard() {
      active.current = false;
      controller.current?.abort();
      setSessionValid(false);
      setProposal(null);
      setMessage(undefined);
    }
    window.addEventListener(SESSION_CHANGED, discard);
    return () => {
      active.current = false;
      controller.current?.abort();
      window.removeEventListener(SESSION_CHANGED, discard);
    };
  }, []);
  function choose(next: Collection, focus = false) {
    if (proposal || !sessionValid) return;
    setCollection(next);
    setMessage(undefined);
    if (focus) (next === "parts" ? partTab : vehicleTab).current?.focus();
  }
  function tabKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    choose(
      event.key === "Home"
        ? "parts"
        : event.key === "End"
          ? "vehicles"
          : collection === "parts"
            ? "vehicles"
            : "parts",
      true,
    );
  }
  function reviewRemove(id: string, name: string) {
    if (stale || proposal || !active.current) return;
    setMessage(undefined);
    uncertain.current = false;
    removed.current = false;
    setProposal({
      title: "Remove saved item?",
      description:
        "This removes the item from your shortlist. You can save it again from its detail page.",
      facts: [
        { label: "Item", value: name },
        { label: "Collection", value: labels[collection] },
      ],
      retryAfterRejection: false,
      onUncertain: () => {
        uncertain.current = true;
      },
      submit: async () => {
        if (!active.current) throw new DOMException("Session changed", "AbortError");
        controller.current = new AbortController();
        await apiRequest(
          `/customers/${collection === "parts" ? "favourites" : "saved-vehicles"}/${id}`,
          { method: "DELETE", csrf: true, body: {}, signal: controller.current.signal },
        );
        if (!active.current) throw new DOMException("Session changed", "AbortError");
        setMessage(`${name} was removed from ${labels[collection].toLowerCase()}.`);
      },
    });
  }
  function closeReview() {
    setProposal(null);
    if (!active.current) return;
    if (uncertain.current || removed.current) {
      refreshCollection();
    }
  }
  function refreshCollection() {
    focusAfterRevision.current = (resource.settledRevision ?? 0) + 1;
    resource.refresh();
  }
  const cards: SavedCardData[] =
    collection === "parts"
      ? (parts.data?.items ?? []).map(({ product: p }) => ({
          id: p.id,
          name: p.name,
          image: (p.images.find((i) => i.isPrimary) ?? p.images[0])?.url,
          category: p.category.name,
          identity: `${p.brand ? `${p.brand} · ` : ""}SKU ${p.sku}`,
          price: p.priceKobo,
          stock: p.availability.some((b) => b.inStock) ? "In stock" : "Out of stock",
        }))
      : (vehicles.data?.items ?? []).map(({ vehicleListing: l }) => ({
          id: l.id,
          name: l.title,
          image: (l.vehicle.images.find((i) => i.isPrimary) ?? l.vehicle.images[0])?.url,
          identity: `${l.vehicle.make} · ${l.vehicle.model} · ${l.vehicle.year}`,
          price: l.priceKobo,
          specs: [
            l.vehicle.mileageKm === null
              ? "Mileage not listed"
              : `${l.vehicle.mileageKm.toLocaleString("en-NG")} km`,
            ...(l.vehicle.transmission ? [human(l.vehicle.transmission)] : []),
            `${l.branch.city}, ${l.branch.state}`,
          ],
        }));
  const empty =
    collection === "parts"
      ? parts.data?.items.length === 0
      : vehicles.data?.items.length === 0;
  const initialLoading = resource.loading && !resource.data;
  return (
    <div className="saved-page">
      <header className="saved-heading">
        <h1>Saved items</h1>
        <p>Your shortlist for the road ahead.</p>
      </header>
      <div className="saved-reservation">
        <Bookmark size={22} aria-hidden="true" />
        <p>
          <strong>Saved items are not reserved.</strong> Check current details before you
          buy.
        </p>
      </div>
      <div role="tablist" aria-label="Saved collections" className="saved-tabs">
        {(["parts", "vehicles"] as const).map((kind) => (
          <button
            key={kind}
            ref={kind === "parts" ? partTab : vehicleTab}
            type="button"
            role="tab"
            id={`saved-tab-${kind}`}
            aria-controls={collection === kind ? `saved-panel-${kind}` : undefined}
            aria-selected={collection === kind}
            tabIndex={collection === kind ? 0 : -1}
            disabled={!!proposal || !sessionValid}
            onKeyDown={tabKey}
            onClick={() => choose(kind)}
          >
            {kind === "parts" ? (
              <Heart size={18} aria-hidden="true" />
            ) : (
              <CarFront size={19} aria-hidden="true" />
            )}
            {labels[kind]}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`saved-panel-${collection}`}
        aria-labelledby={`saved-tab-${collection}`}
        tabIndex={0}
        className="saved-panel"
      >
        <div className="saved-section-heading">
          <div>
            <h2 ref={heading} tabIndex={-1}>
              {labels[collection]}
            </h2>
            <p>
              {collection === "parts"
                ? "Active catalogue items you have saved."
                : "Currently available listings you have saved."}
            </p>
          </div>
          <div className="saved-tools">
            <Link
              className="button"
              href={collection === "parts" ? "/parts" : "/vehicles"}
            >
              Browse {collection}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button
              type="button"
              className="button secondary saved-refresh"
              disabled={
                resource.loading || resource.refreshing || !!proposal || !sessionValid
              }
              onClick={refreshCollection}
              aria-label={`Refresh ${labels[collection].toLowerCase()}`}
            >
              <RefreshCw size={18} aria-hidden="true" />
              <span>Refresh</span>
            </button>
          </div>
        </div>
        <Feedback
          message={message}
          tone="success"
          toast="Your saved items have been updated."
        />
        <Feedback message={resource.error || resource.refreshError} />
        {(resource.error || resource.refreshError) && (
          <p className="saved-retry">
            <button
              className="button secondary"
              disabled={resource.loading || resource.refreshing || !!proposal}
              onClick={refreshCollection}
            >
              Try again
            </button>
            <span>Refresh this collection before making changes.</span>
            {collection === "vehicles" && vehiclePagination.page > 1 && (
              <button
                type="button"
                className="button secondary"
                disabled={resource.loading || resource.refreshing || !!proposal}
                onClick={vehiclePagination.reset}
              >
                Return to first page
              </button>
            )}
          </p>
        )}
        {(resource.loading || resource.refreshing) && (
          <p role="status">
            {initialLoading
              ? `Loading ${labels[collection].toLowerCase()}…`
              : "Refreshing saved items…"}
          </p>
        )}
        {initialLoading && (
          <div className="saved-skeleton" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        )}
        <div
          className={`saved-grid ${collection === "vehicles" ? "saved-grid-vehicles" : ""}`}
          aria-busy={resource.loading || resource.refreshing}
        >
          {cards.map((item) => (
            <article className="saved-card" key={item.id}>
              <Link
                href={`/${collection}/${item.id}`}
                className="saved-image-link"
                tabIndex={-1}
                aria-hidden="true"
              >
                <PublicMedia
                  key={item.image ?? item.id}
                  src={item.image}
                  alt=""
                  fallbackIcon={
                    collection === "vehicles" ? (
                      <CarFront size={40} strokeWidth={1.3} />
                    ) : undefined
                  }
                  sizes="(max-width: 560px) 100vw, (max-width: 1199px) 45vw, 28vw"
                />
              </Link>
              <div className="saved-card-body">
                {item.category && <p className="saved-category">{item.category}</p>}
                <h3>
                  <Link href={`/${collection}/${item.id}`}>{item.name}</Link>
                </h3>
                <p className="saved-identity">{item.identity}</p>
                <div className="saved-price-row">
                  <p className="saved-price">{formatKobo(item.price)}</p>
                  {item.stock && <span className="saved-stock">{item.stock}</span>}
                </div>
                {item.specs && (
                  <ul className="saved-specs">
                    {item.specs.map((spec, index) => (
                      <li key={index}>{spec}</li>
                    ))}
                  </ul>
                )}
                <div className="saved-card-actions">
                  <Link className="button secondary" href={`/${collection}/${item.id}`}>
                    View {collection === "parts" ? "part" : "vehicle"}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    className="button secondary saved-remove"
                    disabled={stale || !!proposal}
                    aria-label={`Remove ${item.name} from ${collection === "parts" ? "favourites" : "saved vehicles"}`}
                    onClick={() => reviewRemove(item.id, item.name)}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!stale && empty && (
          <div className="saved-empty">
            {collection === "parts" ? (
              <Package size={38} strokeWidth={1.4} aria-hidden="true" />
            ) : (
              <CarFront size={42} strokeWidth={1.4} aria-hidden="true" />
            )}
            <h3>
              {collection === "parts" && pagination.page === 1
                ? "Your shortlist starts here"
                : collection === "parts"
                  ? "No favourite parts on this page"
                  : vehiclePagination.page > 1
                    ? "No saved vehicles on this page"
                    : "No available saved vehicles"}
            </h3>
            <p>
              {collection === "parts"
                ? "Save parts from the shop to find them here."
                : "Save a vehicle from the marketplace to keep it in view while it is available."}
            </p>
            <Link
              className="button"
              href={collection === "parts" ? "/parts" : "/vehicles"}
            >
              Browse {collection}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}
        {collection === "parts" && (pagination.page > 1 || !!parts.data?.nextCursor) && (
          <CursorPagination
            pagination={pagination}
            nextCursor={parts.data?.nextCursor}
            disabled={stale || !!proposal}
            label="Favourite parts"
          />
        )}
        {collection === "vehicles" &&
          (vehiclePagination.page > 1 || !!vehicles.data?.nextCursor) && (
            <CursorPagination
              pagination={vehiclePagination}
              nextCursor={vehicles.data?.nextCursor}
              disabled={stale || !!proposal}
              label="Saved vehicles"
            />
          )}
        {!stale && !empty && (
          <p className="saved-page-count">
            {cards.length} {cards.length === 1 ? "item" : "items"} on this page
          </p>
        )}
        <p className="saved-limit-note">
          <Info size={16} aria-hidden="true" />
          <span>
            {collection === "parts"
              ? "Only active catalogue items are shown. Prices and availability can change."
              : "Only currently available saved listings are shown. Saving a vehicle does not reserve it."}
          </span>
        </p>
      </section>
      {proposal && (
        <MutationReview
          proposal={proposal}
          confirmLabel="Remove item"
          exposeBusyState
          onClose={closeReview}
          onSuccess={() => {
            removed.current = true;
          }}
        />
      )}
    </div>
  );
}
