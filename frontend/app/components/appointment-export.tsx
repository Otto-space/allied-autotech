import { appointmentExport, type AppointmentExportInput } from "@/lib/appointment-export";

import styles from "./appointment-export.module.css";

export function AppointmentExport({
  booking,
  now,
  current,
}: {
  booking: AppointmentExportInput;
  now: number;
  current: boolean;
}) {
  const event = current ? appointmentExport(booking, now) : null;
  if (!event) return null;
  return (
    <div className={styles.export}>
      <div className={styles.actions}>
        <a
          className={styles.action}
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(event.calendar)}`}
          download={event.filename}
        >
          Add to calendar (.ics)
        </a>
        <a
          className={styles.action}
          href={event.googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
        >
          Google Calendar (new tab)
        </a>
      </div>
      <p className={styles.hint}>
        Save the confirmed arrival time. After a change, update or remove your saved
        event. Imported events may not sync automatically; check reminder settings in your
        calendar app.
      </p>
    </div>
  );
}
