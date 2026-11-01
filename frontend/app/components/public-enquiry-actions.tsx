import type { ReactNode } from "react";
import Link from "next/link";
import { business } from "@/lib/business";
import { catalogueOnly } from "@/lib/public-launch";

export function PublicEnquiryActions({
  subject,
  message,
  enquiryHref,
  primaryAccessory,
}: {
  subject: string;
  message?: string;
  enquiryHref?: string;
  primaryAccessory?: ReactNode;
}) {
  const draft = Array.from(
    message ?? `Hello Allied AutoTech, I would like more information about ${subject}.`,
  )
    .slice(0, 1200)
    .join("");
  const whatsapp = `${business.whatsapp}?text=${encodeURIComponent(draft)}`;
  return (
    <div className="actions">
      {catalogueOnly() ? (
        <a
          className="button"
          href={`mailto:${business.email}?subject=${encodeURIComponent(subject)}${message ? `&body=${encodeURIComponent(message)}` : ""}`}
        >
          Enquire by email
        </a>
      ) : (
        <Link className="button" href={enquiryHref ?? "/contact#enquiry"}>
          Send an enquiry
        </Link>
      )}
      {primaryAccessory}
      <a
        className="button secondary"
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ask on WhatsApp
      </a>
    </div>
  );
}
