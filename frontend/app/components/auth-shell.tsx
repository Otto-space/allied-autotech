import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthShell({
  children,
}: Readonly<{ children: ReactNode; audience?: "customer" | "staff" }>) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link href="/">
          <Brand />
        </Link>
        <div className="auth-main">
          {children}
          <p className="auth-help">
            <Link className="text-link" href="/help">
              Need help with your account?
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
