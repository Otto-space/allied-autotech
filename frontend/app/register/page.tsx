import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import "./register.css";
import { RegisterForm } from "../components/register-form";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Create account",
};
export default async function Page() {
  const availability = await getPublicCapabilities();
  if (availability.mode === "catalogue") redirect("/contact#enquiry");
  if (!availability.customerAccountsEnabled)
    return (
      <AccessShell mode="register" showRegistrationPanel={false}>
        <div className="login-form">
          <h1>Account creation is temporarily unavailable</h1>
          <p className="login-intro">Please try again shortly or contact our team.</p>
          <Link className="button login-submit" href="/contact">
            Contact Allied AutoTech
          </Link>
        </div>
      </AccessShell>
    );
  return (
    <AccessShell mode="register">
      <RegisterForm />
    </AccessShell>
  );
}
