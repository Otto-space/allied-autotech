import { customerProfileUpdateBodySchema } from "../customers/customers.schemas.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { projectResourceImage, resourceImageSelect } from "../media/media.projection.js";

const vehicleSelect = {
  id: true,
  customerId: true,
  make: true,
  model: true,
  year: true,
  registrationNumber: true,
  mediaImages: {
    select: resourceImageSelect,
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
    take: 1,
  },
} satisfies Prisma.CustomerVehicleSelect;
type SelectedVehicle = Prisma.CustomerVehicleGetPayload<{ select: typeof vehicleSelect }>;
const serializeVehicle = (vehicle: SelectedVehicle | null) =>
  vehicle && {
    id: vehicle.id,
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    registrationNumber: vehicle.registrationNumber,
    photo: vehicle.mediaImages[0] ? projectResourceImage(vehicle.mediaImages[0]) : null,
  };
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
    serviceName: booking.service?.name ?? "Vehicle concern",
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
    defaultVehicle,
    quote,
    payment,
    order,
    appointment,
    requested,
    notification,
    profile,
    enquiry,
    invoice,
    collectionOrder,
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
    // Independent of list pagination and creation order; never guess a default.
    tx.customerVehicle.findFirst({
      where: { customerId, defaultSlot: 1 },
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
    tx.customerProfile.findFirst({
      where: { id: customerId, userId },
      select: { firstName: true },
    }),
    tx.enquiry.findFirst({
      where: { customerId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, subject: true, status: true, updatedAt: true },
    }),
    tx.invoice.findFirst({
      where: { customerId, status: "ISSUED", issuedAt: { not: null } },
      orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        invoiceNumber: true,
        currency: true,
        totalKobo: true,
        issuedAt: true,
      },
    }),
    tx.order.findFirst({
      where: { customerId, status: "READY", fulfillmentMethod: "COLLECTION" },
      orderBy: [{ readyAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        orderNumber: true,
        status: true,
        fulfillmentMethod: true,
        createdAt: true,
      },
    }),
  ]);
  // Even a malformed historical relation must never expose a different customer's vehicle.
  const linked = (current ?? next)?.vehicle;
  const vehicle = linked?.customerId === customerId ? linked : recentVehicle;
  const inspection = appointment ?? requested;
  const name = customerProfileUpdateBodySchema.shape.firstName.safeParse(
    profile?.firstName,
  );
  return {
    firstName: name.success ? (name.data ?? null) : null,
    enquiry: enquiry ? { ...enquiry, updatedAt: enquiry.updatedAt.toISOString() } : null,
    // An issued total is not a balance: credits and payment confirmation remain on the detail.
    invoice: invoice
      ? {
          ...invoice,
          totalKobo: invoice.totalKobo.toString(),
          issuedAt: invoice.issuedAt!.toISOString(),
        }
      : null,
    collectionOrder: collectionOrder
      ? { ...collectionOrder, createdAt: collectionOrder.createdAt.toISOString() }
      : null,
    // Preserve the legacy vehicle/source contract for already released clients.
    vehicle: serializeVehicle(vehicle),
    defaultVehicle: serializeVehicle(defaultVehicle),
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
