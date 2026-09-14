import Link from "next/link";
import { business } from "@/lib/business";
import { Brand } from "./brand";
export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <Brand />
          <p>{business.address}</p>
          <p>
            Instagram · TikTok · Facebook
            <br />
            {business.socialHandle}
          </p>
        </div>
        <nav aria-label="Footer">
          <Link href="/services">Services</Link>
          <Link href="/help">Help centre</Link>
          <Link href="/contact">Contact & directions</Link>
          <Link href="/dashboard">Your account</Link>
        </nav>
        <div>
          <a href={`tel:${business.internationalPhone}`}>{business.phone}</a>
          <a href={`mailto:${business.email}`}>{business.email}</a>
          <a href={business.whatsapp} target="_blank" rel="noreferrer">
            Message on WhatsApp ↗
          </a>
          <p>
            © {new Date().getFullYear()} {business.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
