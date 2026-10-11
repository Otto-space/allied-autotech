import type { Metadata } from "next";
import { SecurityPanel } from "@/app/components/security-panel";
import "@/app/components/account-security.css";
export const metadata: Metadata = { title: "My account security" };
export default function Page() {
  return <SecurityPanel presentation="staff" />;
}
