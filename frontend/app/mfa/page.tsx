import type { Metadata } from "next";
import { AccessShell } from "../components/access-shell";
import "./mfa.css";
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
    <AccessShell mode="mfa">
      <MfaForm enroll={setup === "1"} />
    </AccessShell>
  );
}
