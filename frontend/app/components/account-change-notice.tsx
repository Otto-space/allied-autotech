import Link from "next/link";

export function AccountChangeNotice({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <p className="notice account-change-notice" role="status">
      Your session changed. A request already sent may still have completed.{" "}
      <Link href="/dashboard">Sign in or review your account</Link> before submitting
      again.
    </p>
  );
}
