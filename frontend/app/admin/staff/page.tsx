import type { Metadata } from "next";
import { StaffDirectory } from "@/app/components/staff-directory";
export const metadata: Metadata = { title: "Staff directory" };
export default function Page() {
  return <StaffDirectory />;
}
