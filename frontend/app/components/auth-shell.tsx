import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "./brand";

export function AuthShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <Link href="/">
          <Brand />
        </Link>
        <div className="auth-main">{children}</div>
      </section>
      <aside className="auth-visual" aria-label="Your Allied AutoTech account">
        <div className="auth-statement">
          <span className="auth-monogram" aria-hidden="true">
            A
          </span>
          <h2>
            Your vehicle.
            <br />
            Your next chapter.
          </h2>
          <p>Vehicle care, parts and your workshop visits, connected.</p>
        </div>
        <div className="auth-caption">
          <strong>One secure account for every visit.</strong>
          <p>
            Book available appointments, check payment status, receive reminders, and
            speak with customer care.
          </p>
        </div>
      </aside>
    </main>
  );
}
