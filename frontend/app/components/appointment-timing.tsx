"use client";

import { useEffect, useState } from "react";
import { appointmentCalendarDate, appointmentCountdown } from "@/lib/booking-appointment";
import { formatBusinessDate } from "@/lib/format/date";
import styles from "./appointment-timing.module.css";

export function AppointmentTiming({
  status,
  scheduledAt,
  now,
  current = true,
}: {
  status: string;
  scheduledAt: string | null | undefined;
  now?: number;
  current?: boolean;
}) {
  const [clock, setClock] = useState<number | null>(null);
  const calendar = appointmentCalendarDate(scheduledAt);
  useEffect(() => {
    if (
      now !== undefined ||
      !current ||
      status !== "CONFIRMED" ||
      !scheduledAt ||
      !Number.isFinite(Date.parse(scheduledAt))
    )
      return;
    let active = true;
    const update = () => {
      if (active && document.visibilityState === "visible") setClock(Date.now());
    };
    queueMicrotask(update);
    const timer = window.setInterval(update, 30_000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [now, current, status, scheduledAt]);
  if (!calendar || !scheduledAt)
    return <p>{scheduledAt ? "Date unavailable" : "Time not assigned"}</p>;
  const countdown =
    current && (now !== undefined || clock !== null)
      ? appointmentCountdown(status, scheduledAt, now ?? clock!)
      : null;
  const arrived =
    current &&
    status === "CONFIRMED" &&
    (now !== undefined || clock !== null) &&
    Date.parse(scheduledAt) <= (now ?? clock!);
  return (
    <div className={styles.timing}>
      <time className={styles.calendar} dateTime={scheduledAt} aria-hidden="true">
        <span>{calendar.month}</span>
        <strong>{calendar.day}</strong>
        <span>{calendar.year}</span>
      </time>
      <div className={styles.details}>
        <span className={styles.label}>
          {["REQUESTED", "AWAITING_DEPOSIT"].includes(status)
            ? "Requested time"
            : status === "CONFIRMED"
              ? "Confirmed appointment"
              : "Appointment"}
        </span>
        <time dateTime={scheduledAt}>{formatBusinessDate(scheduledAt)}</time>
        {["REQUESTED", "AWAITING_DEPOSIT"].includes(status) && (
          <small>Awaiting workshop confirmation.</small>
        )}
        {countdown && (
          <p className={styles.countdown} role="timer" aria-live="off">
            {countdown}
          </p>
        )}
        {arrived && (
          <p>Appointment time has arrived. The workshop will update its status.</p>
        )}
      </div>
    </div>
  );
}
