import { SecurityPanel } from "../../components/security-panel";
import type { Metadata } from "next";
import "../../components/account-security.css";
export const metadata: Metadata = { title: "Account security" };
export default function Page() {
  return <SecurityPanel presentation="customer" />;
}
