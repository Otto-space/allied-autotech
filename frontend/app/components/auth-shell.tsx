import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthShell({
  children,
}: Readonly<{ children: ReactNode; audience?: "customer" | "staff" }>) {
  return (
    <main id="main" className="auth-shell">
      <section className="auth-panel">
        <Link href="/" aria-label="Allied AutoTech home">
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
