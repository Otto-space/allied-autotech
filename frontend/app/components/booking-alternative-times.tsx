"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { formatBusinessDate } from "@/lib/format/date";

const optionsSchema = z.object({
  bookingId: z.uuid(),
  bookingVersion: z.number().int(),
  day: z.iso.date(),
  items: z.array(z.object({ startsAt: z.iso.datetime() })).max(40),
});
export function BookingAlternativeTimes({
  path,
  bookingId,
  version,
  inputId,
  scheduledAt,
  disabled = false,
}: {
  path: string;
  bookingId: string;
  version: number;
  inputId: string;
  scheduledAt: string | null;
  disabled?: boolean;
}) {
  const [day, setDay] = useState(() => {
    const now = Date.now(),
      original = scheduledAt ? Date.parse(scheduledAt) : now + 7 * 86_400_000;
    const suggested =
      original > now
        ? Math.max(
            now + 7 * 86_400_000,
            Math.min(original + 86_400_000, now + 13 * 86_400_000),
          )
        : now;
    return new Date(suggested + 3_600_000).toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<Array<{ startsAt: string }>>();
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false),
    [error, setError] = useState<string>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function check() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError(undefined);
    setItems(undefined);
    setSelected("");
    try {
      const response = await apiRequest(
        `${path}/alternative-options?day=${encodeURIComponent(day)}`,
        { signal: controller.signal },
      );
      const options = optionsSchema.parse(response.data);
      if (
        options.bookingId !== bookingId ||
        options.bookingVersion !== version ||
        options.day !== day
      )
        throw new Error("The booking changed. Refresh it before choosing another time.");
      if (!controller.signal.aborted) setItems(options.items);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof ApiError
            ? e.message
            : "Available times could not be checked. Refresh the booking and try again.",
        );
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <>
      <p>
        Check a date for available times with qualified workshop technicians. A recorded
        late visit can be offered a short-notice alternative. Other requests stay 7–14
        days ahead.
      </p>
      <div className="field">
        <label htmlFor={`${inputId}-day`}>Date to check (Nigeria time)</label>
        <input
          id={`${inputId}-day`}
          type="date"
          value={day}
          disabled={disabled}
          onChange={(e) => {
            pending.current?.abort();
            setDay(e.target.value);
            setItems(undefined);
            setSelected("");
            setError(undefined);
            setLoading(false);
          }}
        />
      </div>
      <button
        className="button secondary"
        type="button"
        disabled={disabled || loading || !day}
        onClick={() => void check()}
      >
        {loading
          ? "Checking availability…"
          : error
            ? "Retry availability check"
            : "Check available times"}
      </button>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {items?.length === 0 && (
        <p role="status">
          No available times on this date. Check another date or review the job’s timing
          and workshop resources. The current appointment is unchanged.
        </p>
      )}
      <div className="field">
        <label htmlFor={inputId}>Available time (Nigeria time)</label>
        <select
          id={inputId}
          name="preferredAt"
          required
          value={selected}
          disabled={disabled}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose an available time</option>
          {items?.map((item) => (
            <option
              key={item.startsAt}
              value={new Date(Date.parse(item.startsAt) + 3_600_000)
                .toISOString()
                .slice(0, 16)}
            >
              {formatBusinessDate(item.startsAt)}
            </option>
          ))}
        </select>
      </div>
      <p className="field-hint">
        Availability is checked again when proposing, accepting and approving. A
        suggestion does not reserve capacity.
      </p>
    </>
  );
}
