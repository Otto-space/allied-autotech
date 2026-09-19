import Link from "next/link";
import { business } from "@/lib/business";
import { Brand } from "./brand";

export function SiteFooter() {
  return (
    <footer className="bg-ink text-white pt-24 pb-8 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 mb-32 relative z-10">
        <div>
          <Brand inverse />
          <p className="eyebrow text-white/60! mb-6">Allied AutoTech</p>
          <p className="text-white/80 max-w-xs">{business.address}</p>
          <p className="text-white/80 mt-6">{business.socialHandle}</p>
        </div>
        <div>
          <p className="font-bold mb-6">Services & Parts</p>
          <nav className="flex flex-col gap-4 text-white/70" aria-label="Footer Services">
            <Link href="/services" className="hover:text-white! transition-colors">
              Services
            </Link>
            <Link href="/parts" className="hover:text-white! transition-colors">
              Parts
            </Link>
            <Link href="/vehicles" className="hover:text-white! transition-colors">
              Vehicles
            </Link>
          </nav>
        </div>
        <div>
          <p className="font-bold mb-6">Support</p>
          <nav className="flex flex-col gap-4 text-white/70" aria-label="Footer Support">
            <Link href="/reviews" className="hover:text-white transition-colors">
              Customer reviews
            </Link>
            <Link href="/help" className="hover:text-white transition-colors">
              Help Centre
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              Customer Care
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Your Account
            </Link>
          </nav>
        </div>
        <div>
          <p className="font-bold mb-6">Contact</p>
          <div className="flex flex-col gap-4 text-white/70">
            <a href={`tel:${business.internationalPhone}`} className="hover:text-white">
              {business.phone}
            </a>
            <a href={`mailto:${business.email}`} className="hover:text-white">
              {business.email}
            </a>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-xs text-white/70 pt-8 border-t border-white/10 relative z-10">
        <p>
          © {new Date().getFullYear()} {business.name}. All rights reserved.
        </p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <Link href="/help" className="hover:text-white">
            Help centre
          </Link>
          <Link href="/contact" className="hover:text-white">
            Contact the team
          </Link>
        </div>
      </div>
    </footer>
  );
}
