import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffInvitationForm } from "@/app/components/staff-invitation-form";
import "./staff-invitations.css";
export const metadata: Metadata = { title: "Invitations & staff access" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading invitations and staff access…</p>}>
      <StaffInvitationForm />
    </Suspense>
  );
}
