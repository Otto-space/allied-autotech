import Link from "next/link";
import { business } from "@/lib/business";
import { catalogueOnly } from "@/lib/public-launch";

export function PublicEnquiryActions({ subject }: { subject: string }) {
  const whatsapp = `${business.whatsapp}?text=${encodeURIComponent(`Hello Allied AutoTech, I would like more information about ${subject}.`)}`;
  return (
    <div className="actions">
      {catalogueOnly() ? (
        <a
          className="button"
          href={`mailto:${business.email}?subject=${encodeURIComponent(subject)}`}
        >
          Enquire by email
        </a>
      ) : (
        <Link className="button" href="/contact#enquiry">
          Send an enquiry
        </Link>
      )}
      <a className="button secondary" href={whatsapp} target="_blank" rel="noreferrer">
        Ask on WhatsApp
      </a>
    </div>
  );
}
