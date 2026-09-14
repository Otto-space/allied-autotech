import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { MfaForm } from "../components/mfa-form";
export const metadata: Metadata = { title: "Verify sign in" };
export default function Page() {
  return (
    <AuthShell>
      <MfaForm />
    </AuthShell>
  );
}
