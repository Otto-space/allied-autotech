import type { Metadata } from "next";
import { SupportPanel } from "@/app/components/support-panel";
export const metadata: Metadata = { title: "Customer care workspace" };
export default function Page() {
  return <SupportPanel staff />;
}
