import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { EmailActionForm } from "../components/email-action-form";
export const metadata: Metadata = { title: "Reset password" };
export default function Page() {
  return (
    <AuthShell>
      <EmailActionForm mode="reset" />
    </AuthShell>
  );
}
