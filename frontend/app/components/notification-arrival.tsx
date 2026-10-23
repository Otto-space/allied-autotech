"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useResource } from "@/lib/api/use-resource";
import { notificationSchema } from "@/lib/api/notification-schemas";
import {
  customerNotificationDestination,
  staffNotificationDestination,
} from "@/lib/notifications/destinations";
import { useNotificationAccess } from "@/lib/notifications/access-context";
import { Feedback } from "./feedback";
const parse = (value: unknown) => notificationSchema.parse(value);
export function NotificationArrival({ role }: { role: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const access = useNotificationAccess();
  const id = params.get("notification");
  const valid =
    id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const item = useResource(
    valid ? `/${role === "CUSTOMER" ? "customers" : "staff"}/notifications/${id}` : null,
    parse,
  );
  const destination =
    item.data && !item.error
      ? role === "CUSTOMER"
        ? customerNotificationDestination(item.data)
        : staffNotificationDestination(item.data, access)
      : null;
  const href = destination?.href;
  useEffect(() => {
    if (href) router.replace(href);
  }, [href, router]);
  if (!id) return null;
  if (!valid) return <Feedback message="This notification link is invalid." />;
  if (item.error)
    return (
      <Feedback message="This update is no longer available to your account. Your other notifications are below." />
    );
  if (item.loading || destination) return <p role="status">Opening your update…</p>;
  return item.data ? (
    <article className="card">
      <h2>{item.data.title}</h2>
      <p>{item.data.message}</p>
      <p>Related records may require a current responsibility assignment.</p>
    </article>
  ) : null;
}
