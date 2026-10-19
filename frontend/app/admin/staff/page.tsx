import type { Metadata } from "next";
import { StaffDirectory } from "@/app/components/staff-directory";
import { Suspense } from "react";
import "./staff-directory.css";
export const metadata: Metadata = { title: "Staff directory" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading staff directory…</p>}>
      <StaffDirectory />
    </Suspense>
  );
}
