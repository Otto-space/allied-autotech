import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import { ResetPasswordForm } from "../components/reset-password-form";
import "./reset-password.css";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Reset password",
};
export default function Page() {
  return (
    <AccessShell mode="reset">
      <ResetPasswordForm />
    </AccessShell>
  );
}
