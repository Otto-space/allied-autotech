import Link from "next/link";
import { ChevronRight, KeyRound, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { Brand } from "./brand";
import "../login/login.css";

const contexts = {
  mfa: {
    label: "Verify sign in",
    anchor: "verify-sign-in",
    skip: "Skip to sign-in verification",
  },
  verify: {
    label: "Verify email",
    anchor: "verify-email",
    skip: "Skip to email verification",
  },
  login: { label: "Sign in", anchor: "sign-in", skip: "Skip to sign in" },
  register: {
    label: "Create account",
    anchor: "create-account",
    skip: "Skip to create account",
  },
  forgot: {
    label: "Forgot password",
    anchor: "recover-account",
    skip: "Skip to password recovery",
  },
  reset: {
    label: "Reset password",
    anchor: "reset-password",
    skip: "Skip to reset password",
  },
  invitation: {
    label: "Team invitation",
    anchor: "accept-invitation",
    skip: "Skip to team invitation",
  },
} as const;

export function AccessShell({
  children,
  mode = "login",
}: {
  children: ReactNode;
  mode?: keyof typeof contexts;
}) {
  const { label, anchor, skip } = contexts[mode];
  return (
    <main
      id="main"
      className={`login-page${mode === "register" ? " register-page" : ""}`}
    >
      <a className="login-skip" href={`#${anchor}`}>
        {skip}
      </a>
      <div className="login-masthead">
        <Link className="login-brand" href="/" aria-label="Allied AutoTech home">
          <Brand />
        </Link>
        <p>Built on trust, driven by quality.</p>
      </div>
      <div className="login-layout">
        {mode === "register" && (
          <aside className="login-editorial" aria-label="Your customer account">
            <div className="login-story">
              <span className="login-kicker">Your Allied AutoTech account</span>
              <h2>An account for your vehicle care.</h2>
              <p>Keep your vehicle details and enquiries together.</p>
              <div className="login-story-help">
                <p>
                  Use your own email address and a password you haven’t used elsewhere.
                </p>
                <Link href="/help/account-security">Help with your account</Link>
              </div>
            </div>
          </aside>
        )}
        <section className="login-content" aria-label={label}>
          <nav className="login-breadcrumb" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/">Home</Link>
              </li>
              <li>
                <ChevronRight size={14} aria-hidden="true" />
                <span aria-current="page">{label}</span>
              </li>
            </ol>
          </nav>
          <div id={anchor} className="login-form-area" tabIndex={-1}>
            {(mode === "verify" || mode === "mfa") && (
              <div className="login-card-icon" aria-hidden="true">
                {mode === "verify" ? <Mail size={26} /> : <KeyRound size={26} />}
              </div>
            )}
            {children}
          </div>
        </section>
      </div>
      <footer className="login-footer">
        <span>Allied AutoTech</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/help">Help Centre</Link>
      </footer>
    </main>
  );
}
