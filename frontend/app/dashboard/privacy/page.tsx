import type { Metadata } from "next";
import { CustomerPrivacy } from "@/app/components/customer-privacy";
import "./privacy.css";
export const metadata: Metadata = { title: "Privacy requests" };
export default function Page() {
  return <CustomerPrivacy />;
}
