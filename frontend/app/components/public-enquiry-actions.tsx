import Link from "next/link";
import { business } from "@/lib/business";

export function PublicEnquiryActions({ subject }: { subject: string }) {
  const whatsapp = `${business.whatsapp}?text=${encodeURIComponent(`Hello Allied AutoTech, I would like more information about ${subject}.`)}`;
  return (
    <div className="actions">
      <Link className="button" href="/contact#enquiry">
        Send an enquiry
      </Link>
      <a className="button secondary" href={whatsapp} target="_blank" rel="noreferrer">
        Ask on WhatsApp
      </a>
    </div>
  );
}
