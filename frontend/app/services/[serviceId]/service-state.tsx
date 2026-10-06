import Link from "next/link";
import { Wrench, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import "./service-detail.css";

export function ServiceState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site service-detail">
        <div className="sd-container">
          <nav className="sd-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link href="/services">Services</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">Service details</span>
              </li>
            </ol>
          </nav>
          <div className="sd-state">
            <Wrench size={38} strokeWidth={1.3} aria-hidden="true" />
            <h1>{title}</h1>
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
