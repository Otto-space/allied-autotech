import { SecurityPanel } from "../../components/security-panel";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Account security" };
export default function Page() {
  return <SecurityPanel />;
}
