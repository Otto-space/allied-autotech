import "./invoices.css";
import type { Metadata } from "next";
import { InvoicesPanel } from "../../components/invoices-panel";
export const metadata: Metadata = {
  title: "Your invoices",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <InvoicesPanel />;
}
