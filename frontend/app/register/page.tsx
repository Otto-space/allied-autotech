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
      <AccessShell mode="register">
        <h2>Account creation is temporarily unavailable</h2>
        <p>Please try again shortly or contact our team.</p>
        <Link href="/contact">Contact Allied AutoTech</Link>
      </AccessShell>
    );
  return (
    <AccessShell mode="register">
      <RegisterForm />
    </AccessShell>
  );
}
