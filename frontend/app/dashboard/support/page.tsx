import type { Metadata } from "next";
import { SupportPanel } from "../../components/support-panel";
export const metadata: Metadata = { title: "Customer care" };
export default function Page() {
  return <SupportPanel />;
}
