"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { workSupportQuery } from "@/lib/admin/work-support";
import { useAccountSession } from "./dashboard-shell";
export function rememberCareQueue(
  owner: string,
  id: string,
  kind: string,
  params: string,
) {
  try {
    sessionStorage.setItem(
      `aat:care-return:${owner}`,
      JSON.stringify({ id, kind, params }),
    );
  } catch {}
}
export function CareBackLink({
  id,
  kind,
  branchId,
  className,
  children,
}: {
  id: string;
  kind: string;
  branchId?: string | null;
  className?: string;
  children: ReactNode;
}) {
  const session = useAccountSession(),
    router = useRouter();
  return (
    <Link
      href="/admin/support"
      className={className}
      onClick={(event) => {
        try {
          const saved = JSON.parse(
            sessionStorage.getItem(`aat:care-return:${session?.user.id}`) ?? "null",
          );
          if (
            session &&
            saved?.id === id &&
            saved.kind === kind &&
            typeof saved.params === "string" &&
            saved.params.length < 55000
          ) {
            const query = workSupportQuery(
              new URLSearchParams(saved.params),
              session.user.role,
              branchId,
            );
            if (!query.invalid) {
              event.preventDefault();
              router.push(
                "/admin/support" + (query.params.size ? "?" + query.params : ""),
              );
            }
          }
        } catch {}
      }}
    >
      {children}
    </Link>
  );
}
