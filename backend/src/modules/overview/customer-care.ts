import type { Prisma } from "../../generated/prisma/client.js";

const vehicleSelect = {
  id: true,
  customerId: true,
  make: true,
  model: true,
  year: true,
  registrationNumber: true,
} satisfies Prisma.CustomerVehicleSelect;
const bookingSelect = {
  id: true,
  status: true,
  scheduledAt: true,
  requestedAt: true,
  confirmedAt: true,
  startedAt: true,
  service: { select: { name: true } },
  vehicle: { select: vehicleSelect },
} satisfies Prisma.BookingSelect;
type SelectedBooking = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;
const serializeBooking = (booking: SelectedBooking | null) =>
  booking && {
    id: booking.id,
    status: booking.status,
    serviceName: booking.service.name,
    scheduledAt: booking.scheduledAt.toISOString(),
    requestedAt: booking.requestedAt.toISOString(),
    confirmedAt: booking.confirmedAt?.toISOString() ?? null,
    startedAt: booking.startedAt?.toISOString() ?? null,
  };

/** Current, bounded own-account previews. Historical filters apply only to aggregates. */
export async function customerCare(
  tx: Prisma.TransactionClient,
  customerId: string,
  userId: string,
  now: Date,
) {
  const [
    current,
    next,
    recentVehicle,
    quote,
    payment,
    order,
    appointment,
    requested,
    notification,
  ] = await Promise.all([
    tx.booking.findFirst({
      where: { customerId, status: "IN_PROGRESS" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: bookingSelect,
    }),
    tx.booking.findFirst({
      where: {
        customerId,
        status: { in: ["REQUESTED", "CONFIRMED"] },
        scheduledAt: { gte: now },
      },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      select: bookingSelect,
    }),
    tx.customerVehicle.findFirst({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: vehicleSelect,
    }),
    tx.serviceQuote.findFirst({
      where: {
        booking: { customerId },
        status: "ISSUED",
        issuedAt: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        bookingId: true,
        quoteNumber: true,
        currency: true,
        totalKobo: true,
        issuedAt: true,
        expiresAt: true,
      },
    }),
    tx.payment.findFirst({
      where: {
        customerId,
        OR: [
          {
            status: "REQUIRES_PAYMENT",
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          { status: { in: ["PROCESSING", "REQUIRES_REVIEW"] } },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        paymentNumber: true,
        currency: true,
        amountKobo: true,
        status: true,
        expiresAt: true,
      },
    }),
    tx.order.findFirst({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentMethod: true,
        createdAt: true,
      },
    }),
    tx.inspectionRequest.findFirst({
      where: {
        customerId,
        status: { in: ["CONFIRMED", "RESCHEDULED"] },
        scheduledStartAt: { gte: now },
      },
      orderBy: [{ scheduledStartAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        scheduledStartAt: true,
        preferredStartAt: true,
        vehicleListing: { select: { title: true } },
      },
    }),
    tx.inspectionRequest.findFirst({
      where: { customerId, status: "REQUESTED", preferredStartAt: { gte: now } },
      orderBy: [{ preferredStartAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        scheduledStartAt: true,
        preferredStartAt: true,
        vehicleListing: { select: { title: true } },
      },
    }),
    tx.notification.findFirst({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, title: true, readAt: true, createdAt: true },
    }),
  ]);
  // Even a malformed historical relation must never expose a different customer's vehicle.
  const linked = (current ?? next)?.vehicle;
  const vehicle = linked?.customerId === customerId ? linked : recentVehicle;
  const inspection = appointment ?? requested;
  return {
    vehicle: vehicle
      ? {
          id: vehicle.id,
          make: vehicle.make,
          model: vehicle.model,
          year: vehicle.year,
          registrationNumber: vehicle.registrationNumber,
        }
      : null,
    vehicleSource: vehicle ? (vehicle === linked ? "BOOKING" : "RECENT") : "NONE",
    currentBooking: serializeBooking(current),
    nextBooking: serializeBooking(next),
    quote: quote
      ? {
          ...quote,
          totalKobo: quote.totalKobo.toString(),
          issuedAt: quote.issuedAt!.toISOString(),
          expiresAt: quote.expiresAt?.toISOString() ?? null,
        }
      : null,
    payment: payment
      ? {
          ...payment,
          amountKobo: payment.amountKobo.toString(),
          expiresAt: payment.expiresAt?.toISOString() ?? null,
        }
      : null,
    order: order ? { ...order, createdAt: order.createdAt.toISOString() } : null,
    inspection: inspection
      ? {
          id: inspection.id,
          status: inspection.status,
          title: inspection.vehicleListing.title,
          dateKind: appointment ? "SCHEDULED" : "PREFERRED",
          startsAt: (
            appointment?.scheduledStartAt ?? inspection.preferredStartAt
          ).toISOString(),
        }
      : null,
    notification: notification
      ? {
          ...notification,
          createdAt: notification.createdAt.toISOString(),
          readAt: notification.readAt?.toISOString() ?? null,
        }
      : null,
  };
}
