"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";

const identity = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
});

export function ContactAccountLink() {
  const [access, setAccess] = useState<
    "checking" | "anonymous" | "customer" | "work" | "error"
  >("checking");
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

  if (access === "checking")
    return (
      <p className="contact-account-link" role="status">
        Checking your account link…
      </p>
    );
  if (access === "error")
    return (
      <div className="contact-account-link">
        <p>Your account link is unavailable. You can still use the form below.</p>
        <button
          className="text-link"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry account check
        </button>
      </div>
    );
  const customer = access === "customer";
  const work = access === "work";
  return (
    <p className="contact-account-link">
      {work
        ? "Using a work account? "
        : customer
          ? "Follow up on your requests. "
          : "Already have a customer account? "}
      <Link
        href={
          work
            ? "/admin/support"
            : customer
              ? "/dashboard/support"
              : "/login?next=%2Fdashboard%2Fsupport"
        }
      >
        {work
          ? "Open support workspace"
          : customer
            ? "View customer care"
            : "Sign in to customer care"}
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </p>
  );
}
