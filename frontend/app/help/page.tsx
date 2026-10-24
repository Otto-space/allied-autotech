import { publicPageMetadata, type SearchParameters } from "@/lib/seo";
import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { HelpCentre } from "../components/help-centre";
import "./help.css";
import { browseEnquiriesOnly, catalogueOnly } from "@/lib/public-launch";
import { CatalogueHelp } from "../components/catalogue-help";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}): Promise<Metadata> {
  return publicPageMetadata(
    "Help centre",
    browseEnquiriesOnly()
      ? "Help with Allied AutoTech vehicle care, products, vehicles and contacting our Port Harcourt workshop."
      : "Help with Allied AutoTech service bookings, payments, account access and finding our Port Harcourt workshop.",
    "/help",
    searchParams,
  );
}
export default async function HelpPage({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  const params = await searchParams;
  if (catalogueOnly()) return <CatalogueHelp />;
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  const topic = typeof params.topic === "string" ? params.topic : "All topics";
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-index">
        <header className="help-intro">
          <div className="help-wrap">
            <nav className="help-breadcrumb" aria-label="Breadcrumb">
              <ol>
                <li>
                  <Link href="/">Home</Link>
                  <ChevronRight size={14} aria-hidden="true" />
                </li>
                <li aria-current="page">Help centre</li>
              </ol>
            </nav>
            <h1>Help, when you need it.</h1>
            <p>
              {browseEnquiriesOnly()
                ? "Find services, check parts compatibility and plan a workshop visit."
                : "Find your next step, from booking a visit to checking a payment."}
            </p>
          </div>
        </header>
        <HelpCentre
          key={`${query}\u0000${topic}`}
          initialQuery={query}
          initialTopic={topic}
        />
      </main>
      <SiteFooter />
    </>
  );
}
