import type { Metadata } from "next";
import { WorkAccountProfile } from "@/app/components/work-account-profile";
export const metadata: Metadata = { title: "My profile" };
export default function Page() {
  return <WorkAccountProfile />;
}
