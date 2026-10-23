import { createHash } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import type {
  Prisma,
  PrismaClient,
  ProductCompatibility,
} from "../../generated/prisma/client.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import {
  workforceConflict,
  workforceDenied,
  workforceNotFound,
} from "../organization/workforce.policy.js";
import { decideFitment, normalizeFitmentValue } from "./fitment.engine.js";
import {
  fitmentAccess,
  fitmentProductScope,
  fitmentRuleScope,
  requireFitmentAccess,
  type FitmentAccess,
} from "./fitment.policy.js";
import {
  qualifierKeys,
  type FitmentSelection,
  type RuleWrite,
  type registryListQuerySchema,
  type modelWriteSchema,
  type ruleTransitionSchema,
} from "./fitment.schemas.js";
import type { z } from "zod";

function invalid(message: string): never {
  throw new AppError({ code: "VALIDATION_FAILED", statusCode: 422, message });
}
const keyOf = (name: string) =>
  normalizeFitmentValue(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ");
const literal = (value: string) => value.replace(/[\\%_]/g, "\\$&");
const qualifierData = (input: RuleWrite) =>
  Object.fromEntries(
    qualifierKeys.map((key) => [
      key,
      input[key] ? normalizeFitmentValue(input[key]) : null,
    ]),
  ) as Record<(typeof qualifierKeys)[number], string | null>;
const snapshot = (row: ProductCompatibility) =>
  JSON.parse(JSON.stringify(row)) as Prisma.InputJsonObject;
const page = <T extends { id: string }>(rows: T[], limit: number) => ({
  items: rows.slice(0, limit),
  ...(rows.length > limit ? { nextCursor: rows[limit - 1]!.id } : {}),
});

export const publishedFitmentSelect = {
  id: true,
  reviewStatus: true,
  scope: true,
  effect: true,
  vehicleModelId: true,
  yearFrom: true,
  yearTo: true,
  safetyCritical: true,
  allVariantsConfirmed: true,
  requiredQualifiers: true,
  sourceReference: true,
  reviewedAt: true,
  trim: true,
  engineCode: true,
  market: true,
  position: true,
  brakeSystem: true,
  brakeDiameterMm: true,
  bodyType: true,
  transmission: true,
  generation: true,
  chassisCode: true,
} satisfies Prisma.ProductCompatibilitySelect;

export class FitmentService {
  constructor(private readonly db: PrismaClient = prisma) {}

  private run<T>(
    actor: AuthenticatedActor,
    action: "read" | "author" | "review",
    work: (tx: Prisma.TransactionClient, access: FitmentAccess) => Promise<T>,
  ) {
    return this.db.$transaction(async (tx) => {
      await lockAccessActor(tx, actor);
      const access = await fitmentAccess(tx, actor);
      requireFitmentAccess(access, action);
      return work(tx, access);
    });
  }
  access(actor: AuthenticatedActor) {
    return this.run(actor, "read", async (tx, access) => ({
      ...access,
      branches: await tx.branch.findMany({
        where: {
          isActive: true,
          ...(access.globalAuthor || access.globalReviewer
            ? {}
            : { id: { in: access.branches } }),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    }));
  }
  async makes(query: z.infer<typeof registryListQuerySchema>) {
    return page(
      await this.db.vehicleMake.findMany({
        where: {
          isActive: true,
          ...(query.search
            ? { name: { startsWith: literal(query.search), mode: "insensitive" } }
            : {}),
        },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      query.limit,
    );
  }
  async models(query: z.infer<typeof registryListQuerySchema>) {
    if (!query.makeId) invalid("Choose a make before requesting models");
    return page(
      await this.db.vehicleModel.findMany({
        where: {
          makeId: query.makeId,
          isActive: true,
          make: { isActive: true },
          ...(query.search
            ? { name: { startsWith: literal(query.search), mode: "insensitive" } }
            : {}),
        },
        select: { id: true, makeId: true, name: true, yearFrom: true, yearTo: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      }),
      query.limit,
    );
  }
  async years(modelId: string) {
    const model = await this.db.vehicleModel.findFirst({
      where: { id: modelId, isActive: true, make: { isActive: true } },
      select: { yearFrom: true, yearTo: true },
    });
    if (!model) workforceNotFound();
    return {
      years: Array.from(
        { length: model.yearTo - model.yearFrom + 1 },
        (_, index) => model.yearTo - index,
      ),
    };
  }
  async validateSelection(
    selection: FitmentSelection,
    tx: Prisma.TransactionClient = this.db,
  ) {
    const model = await tx.vehicleModel.findFirst({
      where: { id: selection.vehicleModelId, isActive: true, make: { isActive: true } },
      include: { make: true },
    });
    if (
      !model ||
      (selection.vehicleMakeId && model.makeId !== selection.vehicleMakeId) ||
      selection.year < model.yearFrom ||
      selection.year > model.yearTo
    )
      invalid("Choose a matching make, model and supported model year");
    return model;
  }
  async productFitment(productId: string, selection: FitmentSelection) {
    await this.validateSelection(selection);
    const product = await this.db.product.findFirst({
      where: { id: productId, isActive: true, category: { isActive: true } },
      select: {
        compatibilities: {
          where: { reviewStatus: "APPROVED" },
          select: publishedFitmentSelect,
        },
      },
    });
    if (!product) workforceNotFound();
    return decideFitment(product.compatibilities, selection);
  }
  createMake(actor: AuthenticatedActor, name: string, context: RequestSecurityContext) {
    return this.run(actor, "author", async (tx) => {
      const row = await tx.vehicleMake.create({
        data: { name: name.trim().normalize("NFKC"), key: keyOf(name) },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "FITMENT_MAKE",
        entityId: row.id,
        newValues: { name: row.name },
        context,
      });
      return row;
    });
  }
  createModel(
    actor: AuthenticatedActor,
    input: z.infer<typeof modelWriteSchema>,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, "author", async (tx) => {
      if (
        !(await tx.vehicleMake.findFirst({ where: { id: input.makeId, isActive: true } }))
      )
        invalid("Choose an active catalogue make");
      const row = await tx.vehicleModel.create({
        data: { ...input, name: input.name.normalize("NFKC"), key: keyOf(input.name) },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "FITMENT_MODEL",
        entityId: row.id,
        newValues: {
          makeId: row.makeId,
          name: row.name,
          yearFrom: row.yearFrom,
          yearTo: row.yearTo,
        },
        context,
      });
      return row;
    });
  }
  products(actor: AuthenticatedActor, query: z.infer<typeof registryListQuerySchema>) {
    return this.run(actor, "read", async (tx, access) =>
      page(
        await tx.product.findMany({
          where: {
            AND: [
              fitmentProductScope(access),
              ...(query.search
                ? [
                    {
                      OR: [
                        {
                          name: {
                            contains: literal(query.search),
                            mode: "insensitive" as const,
                          },
                        },
                        {
                          sku: {
                            contains: literal(query.search),
                            mode: "insensitive" as const,
                          },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: { id: true, name: true, sku: true, isActive: true },
          orderBy: { id: "asc" },
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        }),
        query.limit,
      ),
    );
  }
  rules(
    actor: AuthenticatedActor,
    query: {
      productId?: string | undefined;
      reviewStatus?:
        "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "RETIRED" | undefined;
      cursor?: string | undefined;
      limit: number;
    },
  ) {
    return this.run(actor, "read", async (tx, access) =>
      page(
        await tx.productCompatibility.findMany({
          where: {
            AND: [
              fitmentRuleScope(access),
              {
                ...(query.productId ? { productId: query.productId } : {}),
                ...(query.reviewStatus ? { reviewStatus: query.reviewStatus } : {}),
              },
            ],
          },
          include: {
            vehicleModel: { include: { make: true } },
            product: { select: { id: true, name: true, sku: true } },
          },
          orderBy: { id: "asc" },
          take: query.limit + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        }),
        query.limit,
      ),
    );
  }
  history(
    actor: AuthenticatedActor,
    productId: string,
    ruleId: string,
    query: { cursor?: string | undefined; limit: number },
  ) {
    return this.run(actor, "read", async (tx, access) => {
      if (
        !(await tx.productCompatibility.findFirst({
          where: { AND: [{ id: ruleId, productId }, fitmentRuleScope(access)] },
        }))
      )
        workforceNotFound();
      const anchor = query.cursor
        ? await tx.productCompatibilityHistory.findFirst({
            where: { id: query.cursor, compatibilityId: ruleId },
          })
        : null;
      if (query.cursor && !anchor) invalid("History cursor does not belong to this rule");
      return page(
        await tx.productCompatibilityHistory.findMany({
          where: {
            compatibilityId: ruleId,
            ...(anchor ? { version: { gt: anchor.version } } : {}),
          },
          orderBy: { version: "asc" },
          take: query.limit + 1,
        }),
        query.limit,
      );
    });
  }
  private async data(
    tx: Prisma.TransactionClient,
    access: FitmentAccess,
    productId: string,
    input: RuleWrite,
  ) {
    const product = await tx.product.findFirst({
      where: { AND: [{ id: productId }, fitmentProductScope(access)] },
    });
    if (!product) workforceNotFound();
    if (
      !input.safetyCritical &&
      (!product.productType ||
        ["BRAKE_PADS", "BRAKE_DISCS"].includes(product.productType.toUpperCase()))
    )
      invalid(
        "Unknown part types and braking parts require safety-critical fitment. Record the correct product type before proposing non-critical or universal scope.",
      );
    const branchId = input.branchId ?? null;
    if (!access.globalAuthor && (!branchId || !access.authorBranches.includes(branchId)))
      workforceDenied(
        "Choose a branch covered by your current Sales or Operations assignment",
      );
    if (
      branchId &&
      !(await tx.branch.findFirst({ where: { id: branchId, isActive: true } }))
    )
      invalid("Choose an active branch");
    if (
      branchId &&
      !access.globalAuthor &&
      !(await tx.inventory.findFirst({ where: { productId, branchId } }))
    )
      workforceDenied("This product is outside your branch catalogue");
    const model = input.vehicleModelId
      ? await tx.vehicleModel.findFirst({
          where: { id: input.vehicleModelId, isActive: true, make: { isActive: true } },
          include: { make: true },
        })
      : null;
    if (
      input.scope === "MODEL" &&
      (!model ||
        (input.yearFrom != null && input.yearFrom < model.yearFrom) ||
        (input.yearTo != null && input.yearTo > model.yearTo))
    )
      invalid("Use a catalogue model and years within its recorded range");
    const qualifiers = qualifierData(input);
    const semantic = {
      scope: input.scope,
      vehicleModelId: model?.id ?? null,
      yearFrom: input.yearFrom ?? null,
      yearTo: input.yearTo ?? null,
      effect: input.effect,
      safetyCritical: input.safetyCritical,
      allVariantsConfirmed: input.allVariantsConfirmed,
      requiredQualifiers: [...input.requiredQualifiers].sort(),
      ...qualifiers,
    };
    return {
      ...semantic,
      productId,
      branchId,
      make: model?.make.name ?? "Universal",
      model: model?.name ?? null,
      sourceReference: input.sourceReference ?? null,
      evidenceNotes: input.evidenceNotes ?? null,
      notes: input.notes ?? null,
      fingerprint: createHash("sha256").update(JSON.stringify(semantic)).digest("hex"),
    };
  }
  private async record(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    row: ProductCompatibility,
    action: string,
    context: RequestSecurityContext,
  ) {
    await tx.productCompatibilityHistory.create({
      data: {
        compatibilityId: row.id,
        actorUserId: actor.userId,
        action,
        version: row.version,
        snapshot: snapshot(row),
      },
    });
    await appendAuditEvent(tx, {
      actorUserId: actor.userId,
      action: action === "CREATE" ? "CREATE" : "UPDATE",
      entityType: "PRODUCT_FITMENT",
      entityId: row.id,
      newValues: {
        productId: row.productId,
        version: row.version,
        reviewStatus: row.reviewStatus,
        action,
      },
      context,
    });
  }
  createRule(
    actor: AuthenticatedActor,
    productId: string,
    input: RuleWrite,
    context: RequestSecurityContext,
  ) {
    return this.run(actor, "author", async (tx, access) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${productId}`}, 0))`;
      const data = await this.data(tx, access, productId, input);
      if (
        await tx.productCompatibility.findFirst({
          where: { productId, fingerprint: data.fingerprint },
        })
      )
        workforceConflict(
          "An identical fitment rule already exists; edit that rule instead",
        );
      const row = await tx.productCompatibility.create({
        data: { ...data, createdByUserId: actor.userId, updatedByUserId: actor.userId },
      });
      await this.record(tx, actor, row, "CREATE", context);
      return row;
    });
  }
  updateRule(
    actor: AuthenticatedActor,
    productId: string,
    ruleId: string,
    input: RuleWrite & { expectedVersion: number },
    context: RequestSecurityContext,
  ) {
    return this.run(actor, "author", async (tx, access) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${productId}`}, 0))`;
      const old = await tx.productCompatibility.findFirst({
        where: { AND: [{ id: ruleId, productId }, fitmentRuleScope(access, "author")] },
      });
      if (!old) workforceNotFound();
      if (old.version !== input.expectedVersion || old.reviewStatus === "RETIRED")
        workforceConflict();
      const data = await this.data(tx, access, productId, input);
      if (
        await tx.productCompatibility.findFirst({
          where: { productId, fingerprint: data.fingerprint, id: { not: ruleId } },
        })
      )
        workforceConflict("An identical fitment rule already exists");
      if (
        !(await tx.productCompatibilityHistory.findFirst({
          where: { compatibilityId: ruleId },
        }))
      )
        await this.record(tx, actor, old, "LEGACY_CAPTURE", context);
      const row = await tx.productCompatibility.update({
        where: { id: ruleId, version: input.expectedVersion },
        data: {
          ...data,
          reviewStatus: "DRAFT",
          submittedAt: null,
          reviewedAt: null,
          reviewedByUserId: null,
          reviewNote: null,
          createdByUserId: old.createdByUserId ?? actor.userId,
          updatedByUserId: actor.userId,
          version: { increment: 1 },
        },
      });
      await this.record(tx, actor, row, "EDIT", context);
      return row;
    });
  }
  transition(
    actor: AuthenticatedActor,
    productId: string,
    ruleId: string,
    input: z.infer<typeof ruleTransitionSchema>,
    context: RequestSecurityContext,
  ) {
    const review = input.action === "APPROVE" || input.action === "REJECT";
    const retirement = input.action === "RETIRE";
    return this.run(
      actor,
      retirement ? "read" : review ? "review" : "author",
      async (tx, access) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product:${productId}`}, 0))`;
        const old = await tx.productCompatibility.findFirst({
          where: {
            AND: [
              { id: ruleId, productId },
              fitmentRuleScope(
                access,
                retirement ? "read" : review ? "review" : "author",
              ),
            ],
          },
        });
        if (!old) workforceNotFound();
        if (old.version !== input.expectedVersion) workforceConflict();
        if (
          review &&
          (old.createdByUserId === actor.userId || old.updatedByUserId === actor.userId)
        )
          workforceDenied(
            "A different authorized technical reviewer must review this rule",
          );
        if (
          review
            ? old.reviewStatus !== "PENDING"
            : input.action === "SUBMIT"
              ? !["DRAFT", "REJECTED"].includes(old.reviewStatus)
              : old.reviewStatus === "RETIRED"
        )
          workforceConflict(
            "This transition is unavailable for the current review state",
          );
        if (input.action === "SUBMIT" || input.action === "APPROVE") {
          if (
            !old.sourceReference?.trim() ||
            !old.evidenceNotes?.trim() ||
            !old.allVariantsConfirmed
          )
            invalid(
              "Record evidence and explicitly confirm the entire stated variant scope before submission",
            );
          if (
            old.scope === "MODEL" &&
            (!old.vehicleModelId || old.yearFrom === null || old.yearTo === null)
          )
            invalid("Record a normalized model and a bounded year range");
          if (
            old.safetyCritical &&
            (!old.position ||
              !old.brakeSystem ||
              !old.requiredQualifiers.includes("position") ||
              !old.requiredQualifiers.includes("brakeSystem"))
          )
            invalid(
              "Safety-critical fitment requires a confirmed position and brake specification, both required from the customer",
            );
          if (old.scope === "MODEL")
            await this.validateSelection(
              { vehicleModelId: old.vehicleModelId!, year: old.yearFrom! },
              tx,
            );
        }
        if (
          !(await tx.productCompatibilityHistory.findFirst({
            where: { compatibilityId: ruleId },
          }))
        )
          await this.record(tx, actor, old, "LEGACY_CAPTURE", context);
        const status = {
          SUBMIT: "PENDING",
          APPROVE: "APPROVED",
          REJECT: "REJECTED",
          RETIRE: "RETIRED",
        } as const;
        const row = await tx.productCompatibility.update({
          where: { id: ruleId, version: input.expectedVersion },
          data: {
            reviewStatus: status[input.action],
            reviewNote: input.note,
            version: { increment: 1 },
            ...(input.action === "SUBMIT" ? { submittedAt: new Date() } : {}),
            ...(review ? { reviewedAt: new Date(), reviewedByUserId: actor.userId } : {}),
            ...(input.action === "RETIRE" ? { fingerprint: null } : {}),
          },
        });
        await this.record(tx, actor, row, input.action, context);
        return row;
      },
    );
  }
}
