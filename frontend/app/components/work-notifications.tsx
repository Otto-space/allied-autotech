"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useAccountSession } from "./dashboard-shell";
import { NotificationWorkspace } from "./notification-workspace";

export function WorkNotifications() {
  const session = useAccountSession();
  if (!session) return null;
  const { id, role } = session.user;
  if (role !== "STAFF" && role !== "ADMIN" && role !== "SUPER_ADMIN") return null;
  return (
    <div className="customer-notifications work-notifications" key={`${id}:${role}`}>
      <nav aria-label="Breadcrumb" className="wn-breadcrumb">
        <ol>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <ChevronRight size={16} aria-hidden="true" />
            <span aria-current="page">Notifications</span>
          </li>
        </ol>
      </nav>
      <NotificationWorkspace userId={id} role={role} />
    </div>
  );
}
