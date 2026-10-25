"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { normalizeProductQuery } from "@/lib/product-discovery";
import { partsEnquiryHref } from "@/lib/parts-fitment";
import {
  productEnquiryDraft,
  vehicleEnquiryDraft,
  vehicleEnquiryHref,
} from "@/lib/catalogue-enquiry";
import { business } from "@/lib/business";

/** Follow applied client-side filters as well as the server-rendered URL. */
export function CatalogueEnquiryLink({
  kind,
  channel = "contact",
  className,
  children,
}: {
  kind: "product" | "vehicle";
  channel?: "contact" | "whatsapp";
  className?: string;
  children: ReactNode;
}) {
  const input = new URLSearchParams(useSearchParams().toString());
  const href =
    kind === "product"
      ? partsEnquiryHref(normalizeProductQuery(input).params)
      : vehicleEnquiryHref(input);
  if (channel === "whatsapp") {
    const transfer = new URL(href, "https://catalogue.invalid").searchParams;
    const message = (
      kind === "product" ? productEnquiryDraft(transfer) : vehicleEnquiryDraft(transfer)
    ).message;
    return (
      <a
        className={className}
        href={`${business.whatsapp}?text=${encodeURIComponent(Array.from(message).slice(0, 1200).join(""))}`}
        target="_blank"
        rel="noreferrer"
      >
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
