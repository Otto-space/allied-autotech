import type { Metadata } from "next";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { DemoCatalogue } from "./preview";
import "../parts/parts.css";
import "../vehicles/vehicles.css";
import "../components/catalogue-discovery.css";
import "./preview.css";

export const metadata: Metadata = {
  title: "Demo catalogue — fictional examples · Allied AutoTech",
  description:
    "A read-only preview of populated catalogue layouts. All items, prices and availability are fictional examples, not real stock.",
  robots: { index: false, follow: false },
};
export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <DemoCatalogue />
      <SiteFooter />
    </>
  );
}
