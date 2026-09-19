"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import type { StaffListing } from "@/lib/api/staff-vehicle-schemas";
import { positiveNaira } from "@/lib/forms/vehicle-record";
import { nairaToKobo, koboToInput } from "@/lib/format/currency-input";
import { formatKobo } from "@/lib/format/money";
import { Feedback } from "./feedback";
import type { MutationProposal } from "./mutation-review";
type ReviewProps = { disabled: boolean; onReview: (proposal: MutationProposal) => void };
const listingFormSchema = z.object({
  title: z.string().trim().min(1, "Enter a listing title.").max(180),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(180)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase words separated by hyphens."),
  description: z.string().trim().max(10000),
  featured: z.boolean(),
  price: z.string(),
});
const createSchema = listingFormSchema.extend({ price: positiveNaira });
export function VehicleListingForm({
  vehicleId,
  listing,
  disabled,
  onReview,
}: ReviewProps & { vehicleId: string; listing?: StaffListing }) {
  const [uncertain, setUncertain] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState(listing?.version);
  const changed = listing !== undefined && listing.version !== loadedVersion;
  const final = listing?.status === "SOLD" || listing?.status === "ARCHIVED";
  const form = useForm<z.infer<typeof listingFormSchema>>({
    resolver: zodResolver(listing ? listingFormSchema : createSchema),
    defaultValues: {
      title: listing?.title ?? "",
      slug: listing?.slug ?? "",
      description: listing?.description ?? "",
      featured: listing?.featured ?? false,
      price: listing ? koboToInput(listing.priceKobo) : "",
    },
  });
  function review(values: z.infer<typeof listingFormSchema>) {
    if (disabled || uncertain || changed || final) return;
    const content = {
      title: values.title,
      slug: values.slug,
      description: values.description || null,
      featured: values.featured,
    };
    const body:
      | RequestBody<"/staff/vehicles/listings", "post">
      | RequestBody<"/staff/vehicles/listings/{listingId}", "patch"> = listing
      ? { ...content, expectedVersion: listing.version }
      : { ...content, vehicleId, priceKobo: nairaToKobo(values.price) };
    onReview({
      title: listing ? "Save listing details?" : "Create this draft listing?",
      description: listing
        ? "This updates customer-facing listing content. Asking-price and publication changes are reviewed separately."
        : "This creates a draft listing for the selected stock record. It will not appear in the public catalogue until you publish it.",
      facts: [
        { label: "Title", value: content.title },
        { label: "Slug", value: content.slug },
        { label: "Featured", value: content.featured ? "Yes" : "No" },
        ...(!listing
          ? [{ label: "Asking price", value: formatKobo(nairaToKobo(values.price)) }]
          : []),
      ],
      onUncertain: listing ? undefined : () => setUncertain(true),
      submit: () =>
        apiRequest(
          listing ? `/staff/vehicles/listings/${listing.id}` : "/staff/vehicles/listings",
          { method: listing ? "PATCH" : "POST", body, csrf: true },
        ),
    });
  }
  const prefix = listing?.id ?? "new";
  if (final)
    return <p className="notice">Sold and archived listing content cannot be edited.</p>;
  return (
    <form noValidate onSubmit={form.handleSubmit(review)}>
      {changed && listing && (
        <div className="notice">
          <p>
            The listing changed. Your input has been kept. Reload the fields before
            saving.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              form.reset({
                title: listing.title,
                slug: listing.slug,
                description: listing.description ?? "",
                featured: listing.featured,
                price: koboToInput(listing.priceKobo),
              });
              setLoadedVersion(listing.version);
            }}
          >
            Reload listing fields
          </button>
        </div>
      )}
      {uncertain && (
        <p className="notice" role="status">
          Listing creation is unconfirmed. Refresh the vehicle to look for this draft.
          This form will not resend it.
        </p>
      )}
      <fieldset className="handover-fields" disabled={disabled || uncertain || changed}>
        {(
          [
            ["title", "Listing title", 180],
            ["slug", "Listing slug", 180],
            ...(!listing ? [["price", "Asking price (NGN)", 17] as const] : []),
          ] as const
        ).map(([name, label, max]) => (
          <div className="field" key={name}>
            <label htmlFor={`listing-${prefix}-${name}`}>{label}</label>
            <input
              id={`listing-${prefix}-${name}`}
              {...form.register(name)}
              maxLength={max}
              inputMode={name === "price" ? "decimal" : "text"}
              aria-invalid={!!form.formState.errors[name]}
              aria-describedby={
                form.formState.errors[name]
                  ? `listing-${prefix}-${name}-error`
                  : undefined
              }
            />
            {form.formState.errors[name] && (
              <p
                className="field-error"
                role="alert"
                id={`listing-${prefix}-${name}-error`}
              >
                {form.formState.errors[name]?.message}
              </p>
            )}
          </div>
        ))}
        <div className="field">
          <label htmlFor={`listing-${prefix}-description`}>
            Public description (optional)
          </label>
          <textarea
            id={`listing-${prefix}-description`}
            {...form.register("description")}
            maxLength={10000}
            rows={5}
          />
        </div>
        <label className="check-row">
          <input type="checkbox" {...form.register("featured")} /> Feature this listing
        </label>
        <button className="button secondary">
          {listing ? "Review listing details" : "Review draft listing"}
        </button>
      </fieldset>
    </form>
  );
}
const priceSchema = z.object({
  price: positiveNaira,
  reason: z.string().trim().min(1, "Explain the price change.").max(500),
});
export function VehicleListingPrice({
  listing,
  disabled,
  onReview,
}: ReviewProps & { listing: StaffListing }) {
  const form = useForm<z.infer<typeof priceSchema>>({
    resolver: zodResolver(priceSchema),
    defaultValues: { price: koboToInput(listing.priceKobo), reason: "" },
  });
  const [error, setError] = useState<string>();
  const [loadedVersion, setLoadedVersion] = useState(listing.version);
  const changed = listing.version !== loadedVersion;
  if (["RESERVED", "SOLD", "ARCHIVED"].includes(listing.status))
    return (
      <p>
        Asking-price changes are unavailable for a {listing.status.toLowerCase()} listing.
      </p>
    );
  function review(values: z.infer<typeof priceSchema>) {
    if (disabled || changed) return;
    const priceKobo = nairaToKobo(values.price);
    if (priceKobo === listing.priceKobo) {
      setError("Enter a different asking price.");
      form.setFocus("price");
      return;
    }
    setError(undefined);
    const body: RequestBody<"/staff/vehicles/listings/{listingId}/price", "post"> = {
      expectedVersion: listing.version,
      priceKobo,
      reason: values.reason,
    };
    onReview({
      title: "Change the asking price?",
      description:
        "This changes the listing price and records the reason in its history. It does not change negotiated purchase prices or confirm payment. Your account must have a staff profile.",
      facts: [
        { label: "Current price", value: formatKobo(listing.priceKobo) },
        { label: "New price", value: formatKobo(priceKobo) },
        { label: "Reason", value: values.reason },
      ],
      submit: () =>
        apiRequest(`/staff/vehicles/listings/${listing.id}/price`, {
          method: "POST",
          csrf: true,
          body,
        }),
    });
  }
  return (
    <form noValidate onSubmit={form.handleSubmit(review)}>
      {changed && (
        <div className="notice">
          <p>
            The listing changed. Reload the current price before making another change.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              form.reset({ price: koboToInput(listing.priceKobo), reason: "" });
              setLoadedVersion(listing.version);
              setError(undefined);
            }}
          >
            Reload price fields
          </button>
        </div>
      )}
      <fieldset disabled={disabled || changed}>
        <Feedback message={error} />
        <div className="field">
          <label htmlFor={`listing-price-${listing.id}`}>New asking price (NGN)</label>
          <input
            id={`listing-price-${listing.id}`}
            {...form.register("price")}
            inputMode="decimal"
            aria-invalid={!!form.formState.errors.price}
            aria-describedby={
              form.formState.errors.price
                ? `listing-price-${listing.id}-error`
                : undefined
            }
          />
          {form.formState.errors.price && (
            <p
              role="alert"
              className="field-error"
              id={`listing-price-${listing.id}-error`}
            >
              {form.formState.errors.price.message}
            </p>
          )}
        </div>
        <div className="field">
          <label htmlFor={`listing-reason-${listing.id}`}>Price change reason</label>
          <textarea
            id={`listing-reason-${listing.id}`}
            {...form.register("reason")}
            maxLength={500}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={
              form.formState.errors.reason
                ? `listing-reason-${listing.id}-error`
                : undefined
            }
          />
          {form.formState.errors.reason && (
            <p
              role="alert"
              className="field-error"
              id={`listing-reason-${listing.id}-error`}
            >
              {form.formState.errors.reason.message}
            </p>
          )}
        </div>
        <button className="button secondary">Review asking price</button>
      </fieldset>
    </form>
  );
}
const transitions: Record<
  StaffListing["status"],
  readonly ("AVAILABLE" | "INACTIVE" | "ARCHIVED")[]
> = {
  DRAFT: ["AVAILABLE", "INACTIVE"],
  AVAILABLE: ["INACTIVE", "ARCHIVED"],
  INACTIVE: ["AVAILABLE", "ARCHIVED"],
  RESERVED: [],
  SOLD: ["ARCHIVED"],
  ARCHIVED: [],
};
export function VehicleListingStatus({
  listing,
  disabled,
  onReview,
}: ReviewProps & { listing: StaffListing }) {
  const choices = transitions[listing.status];
  const [target, setTarget] = useState(choices[0]);
  if (!choices.length) return null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !target || !choices.includes(target)) return;
        const body: RequestBody<"/staff/vehicles/listings/{listingId}/status", "post"> = {
          expectedVersion: listing.version,
          status: target,
        };
        onReview({
          title: "Change listing publication?",
          description:
            target === "AVAILABLE"
              ? "This makes the listing available to customers while its branch is active. Check the description, price and vehicle details before publishing."
              : target === "ARCHIVED"
                ? "This archives the listing and removes it from the public catalogue. An archived listing cannot be reopened through this workflow."
                : "This removes the listing from the public catalogue. It can be made available again through a separate review.",
          facts: [
            { label: "Listing", value: listing.title },
            { label: "From", value: listing.status },
            { label: "To", value: target },
          ],
          submit: () =>
            apiRequest(`/staff/vehicles/listings/${listing.id}/status`, {
              method: "POST",
              csrf: true,
              body,
            }),
        });
      }}
    >
      <fieldset disabled={disabled}>
        <div className="field">
          <label htmlFor={`listing-status-${listing.id}`}>Next listing status</label>
          <select
            id={`listing-status-${listing.id}`}
            value={target}
            onChange={(event) => {
              const choice = choices.find((value) => value === event.target.value);
              if (choice) setTarget(choice);
            }}
          >
            {choices.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </div>
        <button className="button secondary">Review publication</button>
      </fieldset>
    </form>
  );
}
