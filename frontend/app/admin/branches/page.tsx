import type { Metadata } from "next";
import { Suspense } from "react";
import { BranchesWorkspace } from "@/app/components/branches-workspace";
import "./branches.css";
export const metadata: Metadata = { title: "Branches" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading branches…</p>}>
      <BranchesWorkspace />
    </Suspense>
  );
}
