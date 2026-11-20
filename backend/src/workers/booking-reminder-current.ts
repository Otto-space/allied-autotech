/** A delayed job or provider retry must not send an elapsed appointment reminder. */
export function isCurrentBookingReminder(
  booking: {
    status: string;
    scheduleVersion: number;
    scheduledAt: Date;
  } | null,
  scheduleVersion: number,
  now = Date.now(),
): boolean {
  return (
    booking !== null &&
    booking.status === "CONFIRMED" &&
    booking.scheduleVersion === scheduleVersion &&
    booking.scheduledAt.getTime() > now
  );
}
