import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "./brand";

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link className="auth-brand" href="/" aria-label="Allied AutoTech home">
          <Brand />
        </Link>
        <div className="auth-main">{children}</div>
      </section>
    </main>
  );
}
