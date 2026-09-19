import type { Metadata } from "next";
import { AuthShell } from "@/app/components/auth-shell";
import { AcceptStaffInvitation } from "@/app/components/accept-staff-invitation";
export const metadata: Metadata = {
  title: "Accept team invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <AuthShell audience="staff">
      <AcceptStaffInvitation />
    </AuthShell>
  );
}
