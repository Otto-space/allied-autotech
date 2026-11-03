import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import type { Metadata } from "next";
import "./purchase.css";

export const metadata: Metadata = {
  title: "Private purchases",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="purchase-page" data-no-draft>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
