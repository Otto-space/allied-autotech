import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import { LoginForm } from "../components/login-form";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Sign in",
};
export default function Page() {
  return (
    <AccessShell>
      <LoginForm />
    </AccessShell>
  );
}
