"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";
import { resolveHelpAction, type HelpAccess } from "@/lib/help-actions";

const identity = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
});

export function ArticleAccountAction({ href, action }: { href: string; action: string }) {
  const [access, setAccess] = useState<HelpAccess>("checking");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let pending: AbortController | undefined;
    async function check() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      try {
        const response = await apiRequest("/auth/session", {
          optionalSession: true,
          signal: controller.signal,
        });
        const session = identity.parse(response.data);
        if (!controller.signal.aborted)
          setAccess(session.user.role === "CUSTOMER" ? "customer" : "work");
      } catch (error) {
        if (!controller.signal.aborted)
          setAccess(
            error instanceof ApiError && error.status === 401 ? "anonymous" : "error",
          );
      }
    }
    function changed() {
      setAccess("checking");
      void check();
    }
    void check();
    window.addEventListener(SESSION_CHANGED, changed);
    return () => {
      pending?.abort();
      window.removeEventListener(SESSION_CHANGED, changed);
    };
  }, [retry]);
  if (access === "checking") return <p role="status">Checking your account options…</p>;
  if (access === "error")
    return (
      <div className="ha-account-error">
        <p>
          Account options are unavailable. You can still read this article or contact the
          team.
        </p>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setAccess("checking");
            setRetry((value) => value + 1);
          }}
        >
          Retry account check
        </button>
      </div>
    );
  const target = resolveHelpAction({ href, action }, access);
  if (!target) return null;
  if ("notice" in target)
    return (
      <div className="ha-account-notice">
        <p>{target.notice}</p>
        <Link className="ha-text-link" href="/contact#enquiry">
          Contact customer care <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    );
  return (
    <Link className="button" href={target.href}>
      {target.label}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
