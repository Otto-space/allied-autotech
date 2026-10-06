import Link from "next/link";
import { CarFront, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import "./vehicle-detail.css";

export function VehicleState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site vehicle-detail">
        <div className="vd-container">
          <nav className="vd-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link href="/vehicles">Vehicles</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">Vehicle details</span>
              </li>
            </ol>
          </nav>
          <div className="vd-state">
            <CarFront size={38} strokeWidth={1.3} aria-hidden="true" />
            <h1>{title}</h1>
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
