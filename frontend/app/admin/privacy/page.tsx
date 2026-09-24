import type { Metadata } from "next";
import { PrivacyRequests } from "@/app/components/privacy-requests";
export const metadata: Metadata = { title: "Privacy review" };
export default function Page() {
  return <PrivacyRequests staff />;
}
