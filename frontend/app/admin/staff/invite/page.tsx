import type { Metadata } from "next";
import { StaffInvitationForm } from "@/app/components/staff-invitation-form";
export const metadata: Metadata = { title: "Invite a team member" };
export default function Page() {
  return <StaffInvitationForm />;
}
