import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import "./register.css";
import { RegisterForm } from "../components/register-form";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Create account",
};
export default function Page() {
  return (
    <AccessShell mode="register">
      <RegisterForm />
    </AccessShell>
  );
}
