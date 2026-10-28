import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/config/database.js";
import { SupportRepository } from "../../src/modules/support/support.repository.js";
import { SupportService } from "../../src/modules/support/support.service.js";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import { assertIsolatedLoopbackDatabase } from "../helpers/isolated-database.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "canonical support replay ordering",
  () => {
    const repository = new SupportRepository(prisma),
      service = new SupportService(prisma);
    let actor: AuthenticatedActor, customerId: string, branchId: string;
    beforeAll(async () => {
      await assertIsolatedLoopbackDatabase();
      const branch = await prisma.branch.create({
        data: {
          code: `ORDER-${randomUUID().slice(0, 8)}`,
          name: "Synthetic replay branch",
          address: "Synthetic test address",
          city: "Test",
          state: "Test",
        },
      });
      branchId = branch.id;
      const user = await prisma.user.create({
        data: {
          email: `replay-order-${randomUUID()}@example.test`,
          role: "CUSTOMER",
          passwordHash: "unusable-synthetic-fixture",
          emailVerifiedAt: new Date(),
          profile: {
            create: {
              firstName: "Synthetic",
              lastName: "Replay",
              phone: "+2348000000000",
            },
          },
        },
        include: { profile: true },
      });
      customerId = user.profile!.id;
      actor = {
        userId: user.id,
        sessionId: randomUUID(),
        role: "CUSTOMER",
        email: user.email,
        mfaRequired: false,
        mfaVerifiedAt: null,
      };
    });
    afterAll(async () => {
      await prisma.$disconnect();
    });

    it.each(["enquiry", "complaint"] as const)(
      "does not lose a late %s reply behind a previously delivered cursor",
      async (kind) => {
        const record =
          kind === "enquiry"
            ? await prisma.enquiry.create({
                data: {
                  branchId,
                  customerId,
                  type: "GENERAL",
                  name: "Synthetic",
                  email: actor.email,
                  subject: "Synthetic replay race",
                  message: "Original synthetic question",
                },
              })
            : await prisma.complaint.create({
                data: {
                  branchId,
                  customerId,
                  subject: "Synthetic replay race",
                  description: "Original synthetic complaint",
                },
              });
        const target =
          kind === "enquiry" ? { enquiryId: record.id } : { complaintId: record.id };
        const started = deferred(),
          release = deferred();
        const older = prisma.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT CURRENT_TIMESTAMP`;
            started.resolve();
            await release.promise;
            return repository.createMessage(
              target,
              actor.userId,
              "CUSTOMER",
              "CUSTOMER",
              "Older transaction, later saved reply",
              tx,
            );
          },
          { timeout: 15_000 },
        );
        try {
          await started.promise;
          await new Promise((done) => setTimeout(done, 25));
          const newer = await prisma.$transaction((tx) =>
            repository.createMessage(
              target,
              actor.userId,
              "CUSTOMER",
              "CUSTOMER",
              "Newer transaction, first saved reply",
              tx,
            ),
          );
          const first = await service.customerMessages(actor, kind, record.id, {
            limit: 1,
          });
          expect(first.items.map((message) => message.id)).toEqual([newer.id]);
          release.resolve();
          const late = await older;
          const next = await service.customerMessages(actor, kind, record.id, {
            limit: 1,
            cursor: newer.id,
          });
          expect(next.items.map((message) => message.id)).toEqual([late.id]);
          expect(late.createdAt.getTime()).toBeGreaterThan(newer.createdAt.getTime());
          const replay = await service.customerMessages(actor, kind, record.id, {
            limit: 1,
            cursor: newer.id,
          });
          expect(replay.items.map((message) => message.id)).toEqual([late.id]);
        } finally {
          release.resolve();
          await older;
        }
      },
    );
  },
);
