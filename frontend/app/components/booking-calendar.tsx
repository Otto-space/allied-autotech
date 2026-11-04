"use client";
import { containDialogFocus } from "@/lib/dialog-focus";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { apiRequest, SESSION_CHANGED } from "@/lib/api/client";
import { parseBookings } from "@/lib/api/booking-schemas";
import { bookingLabel } from "@/lib/customer-booking-query";
import {
  calendarMonth,
  nigeriaDay,
  shiftCalendarDay,
  shiftCalendarMonth,
} from "@/lib/booking-calendar";
import { AppointmentTiming } from "./appointment-timing";
import { formatBusinessDate } from "@/lib/format/date";
import { useAccountSession } from "./dashboard-shell";
import styles from "./booking-calendar.module.css";
type Booking = ReturnType<typeof parseBookings>["items"][number];
const datesFor = (row: Booking) =>
  [
    row.scheduledAt,
    ...(["REQUESTED", "CONFIRMED"].includes(row.status) ? [row.alternativeStartsAt] : []),
  ].filter((value): value is string => !!value);
const onDate = (row: Booking, date: string) =>
  datesFor(row).some((value) => nigeriaDay(value) === date);

export function BookingCalendar() {
  const session = useAccountSession();
  const dialog = useRef<HTMLDialogElement>(null),
    opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => dialog.current?.close(), []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  return (
    <>
      <button
        ref={opener}
        type="button"
        className="button secondary"
        onClick={() => {
          setOpen(true);
          dialog.current?.showModal();
        }}
      >
        <CalendarDays size={18} aria-hidden="true" />
        View calendar
      </button>
      <dialog
        onKeyDown={containDialogFocus}
        ref={dialog}
        className={styles.dialog}
        aria-labelledby="booking-calendar-title"
        onCancel={() => setOpen(false)}
        onClose={() => {
          setOpen(false);
          opener.current?.focus();
        }}
      >
        {open && session && <CalendarContent key={session.user.id} close={close} />}
      </dialog>
    </>
  );
}

function CalendarContent({ close }: { close: () => void }) {
  const [today, setToday] = useState(() => nigeriaDay(Date.now()));
  const [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today),
    [revision, setRevision] = useState(0),
    [view, setView] = useState<"month" | "schedule">("month");
  const heading = useRef<HTMLHeadingElement>(null),
    grid = useRef<HTMLTableElement>(null),
    focusDay = useRef<string | null>(null);
  const range = calendarMonth(month);
  const path = `/customers/bookings?${new URLSearchParams({ scheduledFrom: range.from, scheduledTo: range.to, limit: "50" })}`;
  const resourceKey = `${path}:${revision}`;
  const [result, setResult] = useState<{
    path: string;
    items?: Booking[];
    error?: string;
    truncated?: boolean;
  }>();
  const current = result?.path === resourceKey ? result : undefined;
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (!focusDay.current) return;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-day="${focusDay.current}"]`)
      ?.focus();
    focusDay.current = null;
  }, [selected, month]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    queueMicrotask(() => {
      if (active) setResult({ path: resourceKey });
    });
    void (async () => {
      const items: Booking[] = [],
        seen = new Set<string>(),
        cursors = new Set<string>();
      let cursor: string | undefined;
      for (let page = 0; page < 20; page++) {
        const response = await apiRequest(`${path}${cursor ? `&cursor=${cursor}` : ""}`, {
          signal: controller.signal,
        });
        const data = parseBookings(response.data);
        for (const row of data.items) {
          if (
            !datesFor(row).length ||
            datesFor(row).some((date) => !Number.isFinite(Date.parse(date))) ||
            !datesFor(row).some(
              (date) =>
                Date.parse(date) >= Date.parse(range.from) &&
                Date.parse(date) < Date.parse(range.to),
            ) ||
            seen.has(row.id)
          )
            throw Error("Calendar response is inconsistent");
          seen.add(row.id);
          items.push(row);
        }
        cursor = data.nextCursor;
        if (!cursor) {
          if (active) setResult({ path: resourceKey, items });
          return;
        }
        if (cursors.has(cursor)) throw Error("Calendar paging did not advance");
        cursors.add(cursor);
      }
      if (active) setResult({ path: resourceKey, items, truncated: true });
    })().catch(() => {
      if (active && !controller.signal.aborted)
        setResult({
          path: resourceKey,
          error: "We could not load this month. Retry to check your current bookings.",
        });
    });
    const discard = () => {
      active = false;
      controller.abort();
      setResult(undefined);
      close();
    };
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setToday(nigeriaDay(Date.now()));
        setRevision((value) => value + 1);
      }
    };
    const offline = () => {
      active = false;
      controller.abort();
      setResult({
        path: resourceKey,
        error: "You are offline. Reconnect, then retry to check your bookings.",
      });
    };
    globalThis.window.addEventListener(SESSION_CHANGED, discard);
    globalThis.window.addEventListener("online", refresh);
    globalThis.window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      controller.abort();
      globalThis.window.removeEventListener(SESSION_CHANGED, discard);
      globalThis.window.removeEventListener("online", refresh);
      globalThis.window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [path, revision, resourceKey, range.from, range.to, close]);
  const items = current?.items;
  function moveMonth(amount: number) {
    const next = shiftCalendarMonth(month, amount);
    setMonth(next);
    setSelected(`${next}-01`);
  }
  const selectedBookings = items?.filter((row) => onDate(row, selected));
  const schedule = items
    ? Array.from({ length: range.days }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, "0")}`;
        return { date, bookings: items.filter((row) => onDate(row, date)) };
      }).filter((day) => day.bookings.length)
    : [];
  return (
    <div className={styles.content}>
      <header>
        <h2 id="booking-calendar-title" tabIndex={-1} ref={heading}>
          Your appointment calendar
        </h2>
        <button type="button" aria-label="Close appointment calendar" onClick={close}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <p className={styles.explanation}>
        Lagos time · Requested times need workshop confirmation.
      </p>
      <div className={styles.toolbar}>
        <nav aria-label="Calendar months">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => moveMonth(-1)}
            disabled={month === "1900-01"}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h3 aria-live="polite">{range.title}</h3>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => moveMonth(1)}
            disabled={month === "2299-12"}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              const currentDay = nigeriaDay(Date.now());
              setToday(currentDay);
              setMonth(currentDay.slice(0, 7));
              setSelected(currentDay);
            }}
          >
            Today
          </button>
        </nav>
        <div className={styles.views} role="group" aria-label="Calendar view">
          <button
            type="button"
            aria-pressed={view === "month"}
            onClick={() => setView("month")}
          >
            Month
          </button>
          <button
            type="button"
            aria-pressed={view === "schedule"}
            onClick={() => setView("schedule")}
          >
            Schedule
          </button>
        </div>
      </div>
      <p className={styles.monthSummary} aria-live="polite">
        {items
          ? `${items.length} booking${items.length === 1 ? "" : "s"} recorded this month${current.truncated ? " (partial)" : ""}`
          : "Check your appointments by date"}
      </p>
      <div className={view === "month" ? styles.layout : styles.scheduleLayout}>
        {view === "month" && (
          <div className={styles.monthPanel}>
            <table ref={grid} className={styles.month}>
              <caption className="sr-only">
                Choose a date in {range.title}. Use arrow keys to move between dates.
              </caption>
              <thead>
                <tr>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <th scope="col" key={day}>
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: Math.ceil((range.weekday + range.days) / 7) },
                  (_, week) => (
                    <tr key={week}>
                      {Array.from({ length: 7 }, (_, col) => {
                        const day = week * 7 + col - range.weekday + 1;
                        if (day < 1 || day > range.days) return <td key={col} />;
                        const date = `${month}-${String(day).padStart(2, "0")}`,
                          bookings = items?.filter((row) => onDate(row, date)),
                          count = bookings?.length;
                        return (
                          <td key={col}>
                            <button
                              type="button"
                              data-day={date}
                              tabIndex={date === selected ? 0 : -1}
                              aria-pressed={date === selected}
                              aria-current={date === today ? "date" : undefined}
                              aria-label={`${day} ${range.title}${count === undefined ? ", bookings not yet available" : `, ${count} booking${count === 1 ? "" : "s"}${count ? ", " + bookings!.map((row) => (row.scheduledAt && nigeriaDay(row.scheduledAt) === date ? bookingLabel(row.status) : "Proposed time")).join(", ") : ""}`}`}
                              onClick={() => setSelected(date)}
                              onKeyDown={(event) => {
                                const delta = (
                                  {
                                    ArrowLeft: -1,
                                    ArrowRight: 1,
                                    ArrowUp: -7,
                                    ArrowDown: 7,
                                    Home: -col,
                                    End: 6 - col,
                                  } as Record<string, number>
                                )[event.key];
                                if (delta === undefined) return;
                                event.preventDefault();
                                const next = shiftCalendarDay(date, delta);
                                if (next < "1900-01-01" || next > "2299-12-31") return;
                                focusDay.current = next;
                                setMonth(next.slice(0, 7));
                                setSelected(next);
                              }}
                            >
                              <span className={styles.dayNumber}>{day}</span>
                              {!!count && (
                                <small className={styles.dayCount}>
                                  {count}
                                  <span className="sr-only"> bookings</span>
                                </small>
                              )}
                              {!!count && (
                                <span className={styles.dayPreview} aria-hidden="true">
                                  {bookings![0].service?.name ?? "Vehicle concern"}
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <p className={styles.legend}>
              Today is circled. Select a date to see its bookings.
            </p>
          </div>
        )}
        <div className={styles.agenda}>
          {!items && !current?.error && (
            <p role="status">Checking this month’s bookings…</p>
          )}
          {current?.error && (
            <p role="alert">
              {current.error}{" "}
              <button type="button" onClick={() => setRevision((value) => value + 1)}>
                Retry calendar
              </button>
            </p>
          )}
          {current?.truncated && (
            <p role="status">
              This calendar shows the first 1,000 bookings in this month. Use the booking
              list for the remaining records; date counts are partial.
            </p>
          )}
          {view === "month" ? (
            <section aria-label="Selected date bookings">
              <h3>{dateHeading(selected)}</h3>
              {selectedBookings &&
                (selectedBookings.length ? (
                  selectedBookings.map((row) => (
                    <CalendarEntry key={row.id} row={row} date={selected} close={close} />
                  ))
                ) : (
                  <p>
                    No bookings on this date
                    {current?.truncated ? " in the loaded records" : ""}.
                  </p>
                ))}
            </section>
          ) : (
            <section aria-label="Month schedule">
              <h3 className={styles.scheduleTitle}>Schedule for {range.title}</h3>
              {items &&
                (schedule.length ? (
                  schedule.map(({ date, bookings }) => (
                    <section
                      className={styles.scheduleDay}
                      key={date}
                      aria-label={dateHeading(date)}
                    >
                      <h4>{dateHeading(date)}</h4>
                      <div>
                        {bookings.map((row) => (
                          <CalendarEntry
                            key={row.id}
                            row={row}
                            date={date}
                            close={close}
                            compact
                          />
                        ))}
                      </div>
                    </section>
                  ))
                ) : (
                  <p>
                    No bookings this month
                    {current?.truncated ? " in the loaded records" : ""}.
                  </p>
                ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function dateHeading(date: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeZone: "Africa/Lagos",
  }).format(new Date(`${date}T12:00:00+01:00`));
}
function CalendarEntry({
  row,
  date,
  close,
  compact = false,
}: {
  row: Booking;
  date: string;
  close: () => void;
  compact?: boolean;
}) {
  const scheduled = !!row.scheduledAt && nigeriaDay(row.scheduledAt) === date;
  const time = scheduled ? row.scheduledAt : row.alternativeStartsAt;
  return (
    <article className={styles.entry} data-status={scheduled ? row.status : "PROPOSED"}>
      <div className={styles.entryHeading}>
        {time && (
          <time className={styles.eventTime} dateTime={time}>
            {new Intl.DateTimeFormat("en-NG", {
              timeStyle: "short",
              timeZone: "Africa/Lagos",
            }).format(new Date(time))}
          </time>
        )}
        <span className={styles.status}>
          {scheduled ? bookingLabel(row.status) : "Proposed time"}
        </span>
      </div>
      <h4>{row.service?.name ?? "Vehicle concern"}</h4>
      <p>{row.branch?.name ?? "Branch not assigned"}</p>
      {row.alternativeStartsAt && ["REQUESTED", "CONFIRMED"].includes(row.status) && (
        <p>
          Proposed time:{" "}
          <time dateTime={row.alternativeStartsAt}>
            {formatBusinessDate(row.alternativeStartsAt)}
          </time>
          . Review it in booking details; it is not a confirmed appointment.
        </p>
      )}
      {scheduled && !compact && (
        <AppointmentTiming status={row.status} scheduledAt={row.scheduledAt!} />
      )}
      <Link href={`/dashboard/bookings/${row.id}`} onClick={close}>
        View details
      </Link>
    </article>
  );
}
