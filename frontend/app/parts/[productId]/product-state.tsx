import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import "./product-detail.css";

export function ProductState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site product-detail">
        <div className="pd-container">
          <nav className="pd-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <Link href="/parts">Shop</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">Product details</span>
              </li>
            </ol>
          </nav>
          <div className="pd-state">
            <Package size={38} strokeWidth={1.3} aria-hidden="true" />
            <h1>{title}</h1>
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
