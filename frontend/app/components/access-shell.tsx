import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
      <aside className="login-editorial" aria-label="Allied AutoTech">
        <Link className="login-brand" href="/" aria-label="Allied AutoTech home">
          <Brand inverse />
        </Link>
        <div className="login-image">
          <Image
            src="/images/allied-autotech/workshop-editorial.webp"
            alt=""
            fill
            sizes="(min-width: 900px) max(46vw, 130vh), 1px"
          />
        </div>
        <div className="login-story">
          <h2>
            Built on Trust,
            <br />
            Driven by Quality<span>.</span>
          </h2>
          <p>Vehicle care, parts and your account — in one place.</p>
        </div>
      </aside>
      <section className="login-content" aria-label={label}>
        <Link className="login-mobile-brand" href="/" aria-label="Allied AutoTech home">
          <Brand />
        </Link>
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
          {children}
        </div>
      </section>
    </main>
  );
}
