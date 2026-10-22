/** An enquiry preference only: this does not allocate capacity or reserve a vehicle. */
export function visitRequestMessage(
  input: {
    message: string;
    type: string;
    requested: boolean;
    date: string;
    time: string;
  },
  now = new Date(),
): { message: string; error?: undefined } | { error: string; message?: undefined } {
  if (!input.requested || !["SERVICE", "VEHICLE"].includes(input.type))
    return { message: input.message };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^\d{2}:\d{2}$/.test(input.time))
    return { error: "Choose your preferred date and time." };
  const preference = new Date(`${input.date}T${input.time}:00+01:00`);
  // Round-trip the local date/time to reject impossible dates and times.
  if (
    !Number.isFinite(preference.getTime()) ||
    new Date(preference.getTime() + 3_600_000).toISOString().slice(0, 16) !==
      `${input.date}T${input.time}`
  )
    return { error: "Choose a valid date and time." };
  if (preference <= now)
    return { error: "Choose a future date and time in Nigeria time." };
  const label =
    input.type === "SERVICE" ? "Service visit request" : "Vehicle inspection request";
  const message = `${label}\nPreferred date and time: ${input.date} ${input.time} (Africa/Lagos, UTC+01:00)\nStaff confirmation required. No appointment, vehicle reservation or payment is confirmed.\n\n${input.message}`;
  if (message.length > 4000)
    return {
      error:
        "Shorten your message to leave room for the visit request details (4,000 characters in total).",
    };
  return { message };
}
