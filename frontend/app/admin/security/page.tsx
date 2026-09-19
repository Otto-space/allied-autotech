import type { Metadata } from "next";
import { SecurityPanel } from "@/app/components/security-panel";
export const metadata: Metadata = { title: "My account security" };
export default function Page() {
  return <SecurityPanel />;
}
