"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError, SESSION_CHANGED } from "@/lib/api/client";

const identity = z.object({
  user: z.object({
    id: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
  }),
});
type Access = "checking" | "anonymous" | "customer" | "staff" | "admin" | "error";

export function ReviewAccountLink() {
  const [access, setAccess] = useState<Access>("checking");
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
        const { user } = identity.parse(response.data);
        if (!controller.signal.aborted)
          setAccess(
            user.role === "CUSTOMER"
              ? "customer"
              : user.role === "STAFF"
                ? "staff"
                : "admin",
          );
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
      <div className="reviews-account-error">
        <p>Account options are unavailable. Published feedback is still open to read.</p>
        <button
          className="button secondary"
          type="button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Retry account check
        </button>
      </div>
    );
  if (access === "staff") return <p>Reviews are submitted from customer accounts.</p>;
  return (
    <Link
      className="button"
      href={
        access === "admin"
          ? "/admin/reviews"
          : access === "customer"
            ? "/dashboard/reviews"
            : "/login?next=%2Fdashboard%2Freviews"
      }
    >
      {access === "admin"
        ? "Open review moderation"
        : access === "customer"
          ? "Write or check your review"
          : "Sign in to review"}
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}
