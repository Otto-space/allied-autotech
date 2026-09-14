import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { LoginForm } from "../components/login-form";
export const metadata: Metadata = { title: "Sign in" };
export default function Page() {
  return (
    <AuthShell>
      <LoginForm />
    </AuthShell>
  );
}
