import type { Metadata } from "next";
import { PrivacyRequests } from "@/app/components/privacy-requests";
export const metadata: Metadata = { title: "Privacy requests" };
export default function Page() {
  return <PrivacyRequests />;
}
