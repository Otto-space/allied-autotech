import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import { EmailVerificationForm } from "../components/email-verification-form";
import "./verify-email.css";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Verify email",
};
export default function Page() {
  return (
    <AccessShell mode="verify">
      <EmailVerificationForm />
    </AccessShell>
  );
}
