import type { Metadata } from "next";
import { AuthShell } from "../components/auth-shell";
import { MfaForm } from "../components/mfa-form";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Verify sign in",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string }>;
}) {
  const { setup } = await searchParams;
  return (
    <AuthShell>
      <MfaForm enroll={setup === "1"} />
    </AuthShell>
  );
}
