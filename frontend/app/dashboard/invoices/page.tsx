import type { Metadata } from "next";
import { InvoicesPanel } from "../../components/invoices-panel";
export const metadata: Metadata = { title: "Your invoices" };
export default function Page() {
  return <InvoicesPanel />;
}
