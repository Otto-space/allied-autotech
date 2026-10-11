import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import { ForgotPasswordForm } from "../components/forgot-password-form";
import "./forgot-password.css";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Forgot password",
};
export default function Page() {
  return (
    <AccessShell mode="forgot">
      <ForgotPasswordForm />
    </AccessShell>
  );
}
