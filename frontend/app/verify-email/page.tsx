import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { EmailActionForm } from "../components/email-action-form";
import { ResendVerification } from "../components/resend-verification";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Verify email",
};
export default function Page() {
  return (
    <AuthShell>
      <EmailActionForm mode="verify" />
      <ResendVerification />
    </AuthShell>
  );
}
