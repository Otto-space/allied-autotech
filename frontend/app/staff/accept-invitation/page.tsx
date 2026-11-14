import type { Metadata } from "next";
import { AccessShell } from "@/app/components/access-shell";
import { AcceptStaffInvitation } from "@/app/components/accept-staff-invitation";
import "./invitation.css";
export const metadata: Metadata = {
  title: "Accept team invitation",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <AccessShell mode="invitation">
      <div className="login-form invitation-form">
        <AcceptStaffInvitation />
      </div>
    </AccessShell>
  );
}
