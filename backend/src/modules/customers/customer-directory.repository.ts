import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../common/errors/app-error.js";
import type {
  DirectoryCollection,
  DirectoryQuery,
  DirectoryRow,
  RelatedQuery,
} from "./customer-directory.schemas.js";

const cursorSchema = z
  .object({ v: z.literal(1), binding: z.string(), at: z.iso.datetime(), id: z.uuid() })
  .strict();
const binding = (q: DirectoryQuery) =>
  createHash("sha256")
    .update(JSON.stringify([q.search, q.field, q.status, q.verified, q.sort]))
    .digest("hex");
export function decodeDirectoryCursor(q: DirectoryQuery) {
  if (!q.cursor) return undefined;
  try {
    const cursor = cursorSchema.parse(
      JSON.parse(Buffer.from(q.cursor, "base64url").toString("utf8")),
    );
    if (cursor.binding !== binding(q)) throw new Error("Cursor query mismatch");
    return cursor;
  } catch {
    throw new AppError({
      code: "VALIDATION_FAILED",
      statusCode: 422,
      message: "Invalid cursor; restart the customer search",
    });
  }
}
const projection = Prisma.sql`p."id", p."firstName", p."lastName", u."email"::text, p."phone", u."status", (u."emailVerifiedAt" IS NOT NULL) AS "emailVerified", (p."phoneVerifiedAt" IS NOT NULL) AS "phoneVerified", u."createdAt"`;
type StoredRow = Omit<DirectoryRow, "createdAt"> & { createdAt: Date; sortId: string };
export class CustomerDirectoryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}
  async list(q: DirectoryQuery) {
    const cursor = decodeDirectoryCursor(q);
    const clauses = [Prisma.sql`u."role" = 'CUSTOMER'`];
    if (q.status) clauses.push(Prisma.sql`u."status" = ${q.status}::"UserStatus"`);
    if (q.verified)
      clauses.push(
        q.verified === "true"
          ? Prisma.sql`u."emailVerifiedAt" IS NOT NULL`
          : Prisma.sql`u."emailVerifiedAt" IS NULL`,
      );
    if (q.search) {
      const prefix = q.search.replace(/[\\%_]/g, "\\$&") + "%";
      if (q.field === "id") clauses.push(Prisma.sql`p."id" = ${q.search}::uuid`);
      if (q.field === "email")
        clauses.push(Prisma.sql`lower(u."email"::text) LIKE ${prefix}`);
      if (q.field === "phone")
        clauses.push(
          Prisma.sql`regexp_replace(p."phone", '[^0-9]', '', 'g') LIKE ${q.search.replace(/\D/g, "") + "%"}`,
        );
      if (q.field === "name")
        clauses.push(
          Prisma.sql`(lower(regexp_replace(trim(p."firstName" || ' ' || p."lastName"), '\\s+', ' ', 'g')) LIKE ${prefix} OR lower(p."lastName") LIKE ${prefix})`,
        );
    }
    const direction = q.sort === "oldest" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    if (cursor)
      clauses.push(
        q.sort === "oldest"
          ? Prisma.sql`(u."createdAt", u."id") > (${new Date(cursor.at)}, ${cursor.id}::uuid)`
          : Prisma.sql`(u."createdAt", u."id") < (${new Date(cursor.at)}, ${cursor.id}::uuid)`,
      );
    const rows = await this.db.$queryRaw<StoredRow[]>(
      Prisma.sql`SELECT ${projection}, u."id" AS "sortId" FROM "CustomerProfile" p JOIN "User" u ON u."id" = p."userId" WHERE ${Prisma.join(clauses, " AND ")} ORDER BY u."createdAt" ${direction}, u."id" ${direction} LIMIT ${q.limit + 1}`,
    );
    const items = rows.slice(0, q.limit).map(({ sortId: _sortId, ...r }) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
    const last = rows.slice(0, q.limit).at(-1);
    return {
      items,
      ...(rows.length > q.limit && last
        ? {
            nextCursor: Buffer.from(
              JSON.stringify({
                v: 1,
                binding: binding(q),
                at: last.createdAt.toISOString(),
                id: last.sortId,
              }),
            ).toString("base64url"),
          }
        : {}),
    };
  }
  async detail(id: string) {
    const rows = await this.db.$queryRaw<
      (Omit<StoredRow, "sortId"> & {
        address: string | null;
        city: string | null;
        state: string | null;
        country: string;
      })[]
    >(
      Prisma.sql`SELECT ${projection}, p."address", p."city", p."state", p."country" FROM "CustomerProfile" p JOIN "User" u ON u."id" = p."userId" WHERE p."id" = ${id}::uuid AND u."role" = 'CUSTOMER'`,
    );
    const row = rows[0];
    return row ? { ...row, createdAt: row.createdAt.toISOString() } : null;
  }
  async related(id: string, kind: DirectoryCollection, q: RelatedQuery) {
    // Static SQL fragments only: neither table names nor projections come from the request.
    const sources = {
      vehicles: {
        from: Prisma.sql`"CustomerVehicle" r`,
        owner: Prisma.sql`r."customerId"`,
        title: Prisma.sql`r."year"::text || ' ' || r."make" || ' ' || r."model"`,
        status: Prisma.sql`NULL::text`,
        amount: Prisma.sql`NULL::text`,
        currency: Prisma.sql`NULL::text`,
      },
      bookings: {
        from: Prisma.sql`"Booking" r JOIN "Service" s ON s."id" = r."serviceId"`,
        owner: Prisma.sql`r."customerId"`,
        title: Prisma.sql`s."name"`,
        status: Prisma.sql`r."status"::text`,
        amount: Prisma.sql`r."quotedPriceKobo"::text`,
        currency: Prisma.sql`r."currency"`,
      },
      quotations: {
        from: Prisma.sql`"ServiceQuote" r JOIN "Booking" b ON b."id" = r."bookingId"`,
        owner: Prisma.sql`b."customerId"`,
        title: Prisma.sql`r."quoteNumber"`,
        status: Prisma.sql`r."status"::text`,
        amount: Prisma.sql`r."totalKobo"::text`,
        currency: Prisma.sql`r."currency"`,
      },
      orders: {
        from: Prisma.sql`"Order" r`,
        owner: Prisma.sql`r."customerId"`,
        title: Prisma.sql`r."orderNumber"`,
        status: Prisma.sql`r."status"::text`,
        amount: Prisma.sql`r."totalKobo"::text`,
        currency: Prisma.sql`r."currency"`,
      },
      payments: {
        from: Prisma.sql`"Payment" r`,
        owner: Prisma.sql`r."customerId"`,
        title: Prisma.sql`r."paymentNumber"`,
        status: Prisma.sql`r."status"::text`,
        amount: Prisma.sql`r."amountKobo"::text`,
        currency: Prisma.sql`r."currency"`,
      },
      enquiries: {
        from: Prisma.sql`"Enquiry" r`,
        owner: Prisma.sql`r."customerId"`,
        title: Prisma.sql`r."subject"`,
        status: Prisma.sql`r."status"::text`,
        amount: Prisma.sql`NULL::text`,
        currency: Prisma.sql`NULL::text`,
      },
      complaints: {
        from: Prisma.sql`"Complaint" r`,
        owner: Prisma.sql`r."customerId"`,
        title: Prisma.sql`r."subject"`,
        status: Prisma.sql`r."status"::text`,
        amount: Prisma.sql`NULL::text`,
        currency: Prisma.sql`NULL::text`,
      },
    };
    const s = sources[kind];
    if (q.cursor) {
      const found = await this.db.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT r."id" FROM ${s.from} WHERE ${s.owner} = ${id}::uuid AND r."id" = ${q.cursor}::uuid`,
      );
      if (!found.length)
        throw new AppError({
          code: "VALIDATION_FAILED",
          statusCode: 422,
          message: "Invalid collection cursor",
        });
    }
    const rows = await this.db.$queryRaw<
      {
        id: string;
        title: string;
        status: string | null;
        createdAt: Date;
        amountKobo: string | null;
        currency: string | null;
      }[]
    >(
      Prisma.sql`SELECT r."id", ${s.title} AS title, ${s.status} AS status, r."createdAt", ${s.amount} AS "amountKobo", ${s.currency} AS currency FROM ${s.from} WHERE ${s.owner} = ${id}::uuid ${q.cursor ? Prisma.sql`AND r."id" > ${q.cursor}::uuid` : Prisma.empty} ORDER BY r."id" ASC LIMIT ${q.limit + 1}`,
    );
    const items = rows
      .slice(0, q.limit)
      .map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    const last = items.at(-1);
    return { items, ...(rows.length > q.limit && last ? { nextCursor: last.id } : {}) };
  }
}
