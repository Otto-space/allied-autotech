import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffInvitationForm } from "@/app/components/staff-invitation-form";
import "./staff-invitations.css";
export const metadata: Metadata = { title: "Promotions & invitations" };
export default function Page() {
  return (
    <Suspense fallback={<p role="status">Loading promotions and invitations…</p>}>
      <StaffInvitationForm />
    </Suspense>
  );
}
