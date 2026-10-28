import type { Prisma } from "../../generated/prisma/client.js";
import { invoiceConflict } from "./billing.errors.js";
import { invoiceSnapshotSchema, type InvoiceSnapshot } from "./document.schemas.js";

export const approvedIssuer = {
  name: "Allied AutoTech",
  address: "133 Stadium Road, beside Kilimanjaro Pizza Jungle Restaurant, Port Harcourt, Rivers State, Nigeria",
  paymentTerms: "",
};

export function issuerFromPolicy(policy: unknown): InvoiceSnapshot["issuer"] {
  if (policy && typeof policy === "object" && "settings" in policy) {
    const settings = policy.settings;
    if (
      settings &&
      typeof settings === "object" &&
      "invoiceName" in settings &&
      "invoiceAddress" in settings &&
      "paymentTerms" in settings
    ) {
      const parsed = invoiceSnapshotSchema.shape.issuer.safeParse({
        name: settings.invoiceName,
        address: settings.invoiceAddress,
        paymentTerms: settings.paymentTerms,
      });
      if (parsed.success) return parsed.data;
    }
  }
  return { ...approvedIssuer };
}

type InvoiceSource = {
  customerId: string;
  orderId?: string | null;
  bookingId?: string | null;
  vehicleTransactionId?: string | null;
  subtotalKobo: bigint | number;
  taxKobo: bigint | number;
  totalKobo: bigint | number;
  depositCreditKobo?: bigint | number;
  policySnapshot?: unknown;
};
export function assertDocumentTotals(
  snapshot: InvoiceSnapshot,
  invoice: InvoiceSource,
): void {
  let subtotal = 0n;
  for (const line of snapshot.lines) {
    if (BigInt(line.unitPriceKobo) * BigInt(line.quantity) !== BigInt(line.subtotalKobo))
      throw invoiceConflict("Invoice line amounts are inconsistent");
    subtotal += BigInt(line.subtotalKobo);
  }
  if (
    subtotal - BigInt(snapshot.discountKobo) + BigInt(snapshot.deliveryKobo) !==
      BigInt(invoice.subtotalKobo) ||
    BigInt(invoice.subtotalKobo) +
      BigInt(invoice.taxKobo) -
      BigInt(invoice.depositCreditKobo ?? 0) !==
      BigInt(invoice.totalKobo)
  )
    throw invoiceConflict("Invoice document totals are inconsistent");
}

/** Called inside invoice creation's existing transaction; never accepts client prices. */
export async function buildInvoiceSnapshot(
  database: Prisma.TransactionClient,
  invoice: InvoiceSource,
  legacy = false,
): Promise<InvoiceSnapshot> {
  const customer = await database.customerProfile.findUnique({
    where: { id: invoice.customerId },
    select: {
      firstName: true,
      lastName: true,
      address: true,
      city: true,
      state: true,
      country: true,
    },
  });
  if (!customer) throw invoiceConflict("Invoice account is unavailable");
  const reference = invoice.orderId ?? invoice.bookingId ?? invoice.vehicleTransactionId;
  if (!reference) throw invoiceConflict("Invoice source is unavailable");
  const snapshot: InvoiceSnapshot = {
    schemaVersion: 1,
    issuer: issuerFromPolicy(invoice.policySnapshot),
    billTo: {
      name: legacy
        ? "Account holder"
        : `${customer.firstName} ${customer.lastName}`.trim(),
      address: legacy
        ? null
        : [customer.address, customer.city, customer.state, customer.country]
            .filter(Boolean)
            .join(", ") || null,
      reference: invoice.customerId,
    },
    source: {
      type: invoice.orderId
        ? "ORDER"
        : invoice.bookingId
          ? "BOOKING"
          : "VEHICLE_TRANSACTION",
      id: reference,
      reference,
      description: "Vehicle purchase",
    },
    lines: [],
    discountKobo: "0",
    deliveryKobo: "0",
    detailBasis: legacy ? "SOURCE_RECORDS" : "SNAPSHOT",
  };
  if (invoice.orderId) {
    const order = await database.order.findUnique({
      where: { id: invoice.orderId },
      select: {
        customerId: true,
        orderNumber: true,
        customerName: true,
        discountAmountKobo: true,
        deliveryFeeKobo: true,
        items: {
          take: 201,
          orderBy: { id: "asc" },
          select: {
            productName: true,
            quantity: true,
            unitPriceKobo: true,
            subtotalKobo: true,
          },
        },
      },
    });
    if (!order || order.customerId !== invoice.customerId)
      throw invoiceConflict("Invoice source is unavailable");
    snapshot.billTo.name = order.customerName;
    snapshot.source.reference = order.orderNumber;
    snapshot.source.description = "Parts order";
    snapshot.discountKobo = order.discountAmountKobo.toString();
    snapshot.deliveryKobo = order.deliveryFeeKobo.toString();
    snapshot.lines = order.items.map((item) => ({
      description: item.productName,
      quantity: item.quantity,
      unitPriceKobo: item.unitPriceKobo.toString(),
      subtotalKobo: item.subtotalKobo.toString(),
    }));
  } else if (invoice.bookingId) {
    const quote = await database.serviceQuote.findFirst({
      where: {
        bookingId: invoice.bookingId,
        status: "ACCEPTED",
        booking: { customerId: invoice.customerId },
      },
      orderBy: { version: "desc" },
      select: {
        quoteNumber: true,
        items: {
          take: 201,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            description: true,
            quantity: true,
            unitPriceKobo: true,
            subtotalKobo: true,
          },
        },
      },
    });
    snapshot.source.description = "Service booking";
    if (quote) {
      snapshot.source.reference = quote.quoteNumber;
      snapshot.lines = quote.items.map((item) => ({
        ...item,
        unitPriceKobo: item.unitPriceKobo.toString(),
        subtotalKobo: item.subtotalKobo.toString(),
      }));
    }
  } else {
    const purchase = await database.vehicleTransaction.findUnique({
      where: { id: reference },
      select: {
        customerId: true,
        transactionNumber: true,
        vehicleListing: { select: { title: true } },
      },
    });
    if (!purchase || purchase.customerId !== invoice.customerId)
      throw invoiceConflict("Invoice source is unavailable");
    snapshot.source.reference = purchase.transactionNumber;
    snapshot.lines = [
      {
        description: legacy
          ? `Vehicle purchase ${purchase.transactionNumber}`
          : purchase.vehicleListing.title,
        quantity: 1,
        unitPriceKobo: invoice.subtotalKobo.toString(),
        subtotalKobo: invoice.subtotalKobo.toString(),
      },
    ];
  }
  if (legacy) {
    // Never present current customer details as historic invoice identity. Only
    // source records that still reconcile may supply a historic breakdown.
    try {
      assertDocumentTotals(invoiceSnapshotSchema.parse(snapshot), invoice);
    } catch {
      snapshot.detailBasis = "LEGACY_SUMMARY";
      snapshot.discountKobo = "0";
      snapshot.deliveryKobo = "0";
      snapshot.lines = [
        {
          description: "Recorded invoice subtotal",
          quantity: 1,
          unitPriceKobo: invoice.subtotalKobo.toString(),
          subtotalKobo: invoice.subtotalKobo.toString(),
        },
      ];
    }
  }
  const parsed = invoiceSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) throw invoiceConflict("Invoice document details are incomplete");
  assertDocumentTotals(parsed.data, invoice);
  return parsed.data;
}
