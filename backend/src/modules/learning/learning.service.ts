import { createHash } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { workforceSnapshot } from "../organization/workforce.policy.js";
import {
  learningArticles,
  learningGuides,
  practiceDefinitions,
  type LearningGate,
} from "./learning.content.js";

export interface LearningAccess {
  role: "PUBLIC" | "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN";
  managed: boolean;
  verified: boolean;
  permissions: readonly string[];
  position: string | null;
  canManage: boolean;
  key: string;
}
export const publicLearningAccess: LearningAccess = {
  role: "PUBLIC",
  managed: false,
  verified: false,
  permissions: [],
  position: null,
  canManage: false,
  key: "public",
};
export const learningUnavailable = () =>
  new AppError({
    code: "NOT_FOUND",
    statusCode: 404,
    message: "Learning content is unavailable",
  });
export function learningEligible(access: LearningAccess, gate: LearningGate) {
  const can = (permission: string) => access.permissions.includes(permission);
  const globalAdmin =
    access.role === "SUPER_ADMIN" || (access.role === "ADMIN" && !access.managed);
  const work = !["PUBLIC", "CUSTOMER"].includes(access.role) && access.verified;
  switch (gate) {
    case "public":
      return true;
    case "customer":
      return access.role === "CUSTOMER" && access.verified;
    case "work":
      return work;
    case "care":
      return work && (globalAdmin || can("CUSTOMER_ENQUIRIES") || can("COMPLAINTS"));
    case "sales":
      return work && can("SALES_ENQUIRIES");
    case "finance":
      return work && can("FINANCE_READ");
    case "jobs":
      return work && can("JOBS_UPDATE") && can("JOBS_READ");
    case "assign":
      return work && can("JOBS_ASSIGN");
    case "operations":
      return work && can("ORDERS_PREPARE") && can("BOOKINGS_READ");
    case "oversight":
      return work && access.position === "CEO_MD";
    case "admin":
      return (
        work &&
        (access.role === "SUPER_ADMIN" || (access.role === "ADMIN" && !access.managed))
      );
    case "access":
      return work && (access.canManage || (access.role === "ADMIN" && !access.managed));
    case "owner":
      return work && access.role === "SUPER_ADMIN";
  }
}
export async function currentLearningAccess(
  actor: AuthenticatedActor,
): Promise<LearningAccess> {
  return prisma.$transaction((tx) => learningAccessInTransaction(tx, actor));
}
export async function learningAccessInTransaction(
  tx: Prisma.TransactionClient,
  actor: AuthenticatedActor,
): Promise<LearningAccess> {
  if (actor.role === "CUSTOMER") {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor.userId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${actor.sessionId}::uuid FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: actor.userId },
      select: { role: true, status: true, emailVerifiedAt: true },
    });
    const session = await tx.session.findFirst({
      where: {
        id: actor.sessionId,
        userId: actor.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        idleExpiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!user || user.status !== "ACTIVE" || user.role !== actor.role || !session)
      throw learningUnavailable();
    return {
      ...publicLearningAccess,
      role: "CUSTOMER",
      verified: !!user.emailVerifiedAt,
      key: createHash("sha256")
        .update(
          JSON.stringify([
            actor.userId,
            actor.sessionId,
            user.role,
            !!user.emailVerifiedAt,
          ]),
        )
        .digest("hex"),
    };
  }
  await lockAccessActor(tx, actor);
  const snapshot = await workforceSnapshot(tx, actor);
  return {
    role: actor.role,
    verified: true,
    managed: snapshot.managed,
    permissions: snapshot.permissions,
    position: snapshot.position,
    canManage: snapshot.canManageAssignments,
    key: createHash("sha256")
      .update(
        JSON.stringify([
          actor.userId,
          actor.sessionId,
          actor.role,
          snapshot.version,
          snapshot.permissions,
          snapshot.assignments.map((a) => [a.id, a.branchId, a.scope]),
          snapshot.canManageAssignments,
        ]),
      )
      .digest("hex"),
  };
}
function textWords(value: string) {
  const synonyms: Record<string, string> = {
    shop: "part",
    quotation: "quote",
    appointment: "booking",
    cash: "payment",
    login: "access",
    products: "part",
    product: "part",
    parts: "part",
    photos: "image",
    photo: "image",
    images: "image",
    fitment: "compatibility",
    support: "care",
    customer: "care",
  };
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter(Boolean)
    .filter(
      (word) =>
        !/^(how|do|does|i|can|my|your|what|is|the|a|an|to|me|please|with)$/.test(word),
    )
    .map((word) => synonyms[word] ?? word);
}
export function learningCatalogue(access: LearningAccess, query = "") {
  if (!env.HELP_LEARN_ENABLED) throw learningUnavailable();
  const published = learningArticles.filter(
    (a) => a.status === "published" && learningEligible(access, a.gate),
  );
  const visibleIds = new Set(published.map((a) => a.id));
  const words = textWords(query);
  const matches = (...fields: string[]) => {
    const haystack = textWords(fields.join(" ")).join(" ");
    return words.every((word) => haystack.includes(word));
  };
  const parentText = (id: string) => {
    const parent = published.find((a) => a.id === id);
    return parent ? [parent.title, parent.summary, parent.keywords].join(" ") : "";
  };
  const articles = published
    .filter((a) => matches("article answer", a.title, a.summary, a.keywords, ...a.steps))
    .map(({ gate: _gate, ...a }) => {
      // Complaint-only officers must not be directed to an unavailable enquiry queue.
      if (
        a.id === "care-triage" &&
        !access.managed &&
        ["ADMIN", "SUPER_ADMIN"].includes(access.role)
      )
        return { ...a, href: "/admin/support" };
      if (a.id === "care-triage" && !access.permissions.includes("CUSTOMER_ENQUIRIES"))
        return { ...a, href: "/admin/workforce/complaints" };
      if (a.id === "access-review" && !access.managed && access.role === "ADMIN")
        return { ...a, href: "/admin/staff" };
      return a;
    });
  return {
    accessKey: createHash("sha256")
      .update(access.key + ":v1:" + env.PUBLIC_LAUNCH_MODE)
      .digest("hex"),
    audience:
      access.role === "PUBLIC"
        ? ("public" as const)
        : access.role === "CUSTOMER"
          ? ("customer" as const)
          : ("work" as const),
    contentVersion: 1 as const,
    mode: env.PUBLIC_LAUNCH_MODE,
    flags: {
      guides: env.HELP_LEARN_GUIDES_ENABLED,
      practice: env.HELP_LEARN_PRACTICE_ENABLED,
      ai:
        env.HELP_LEARN_ENABLED &&
        env.HELP_LEARN_AI_ENABLED &&
        env.PUBLIC_LAUNCH_MODE !== "catalogue" &&
        !!env.OPENAI_API_KEY &&
        !!env.ALLIE_OPENAI_MODEL &&
        env.ALLIE_AI_DAILY_TOKEN_LIMIT >= 32000,
    },
    articles,
    guides: env.HELP_LEARN_GUIDES_ENABLED
      ? learningGuides
          .filter(
            (g) =>
              visibleIds.has(g.articleId) &&
              learningEligible(access, g.gate) &&
              matches(
                "guide walkthrough",
                g.title,
                ...g.steps.map((s) => s.text),
                parentText(g.articleId),
              ) &&
              !(
                g.id === "care-queue" &&
                !access.permissions.includes("CUSTOMER_ENQUIRIES")
              ),
          )
          .map(({ gate: _gate, ...g }) => g)
      : [],
    scenarios: env.HELP_LEARN_PRACTICE_ENABLED
      ? practiceDefinitions
          .filter(
            (s) =>
              visibleIds.has(s.articleId) &&
              learningEligible(access, s.gate) &&
              matches(
                "practice practise sample",
                s.title,
                s.objective,
                parentText(s.articleId),
              ),
          )
          .map(({ id, title, objective, version, articleId }) => ({
            id,
            title,
            objective,
            version,
            articleId,
          }))
      : [],
  };
}
export function learningItem(
  access: LearningAccess,
  kind: "articles" | "guides" | "scenarios",
  id: string,
) {
  const catalogue = learningCatalogue(access);
  if (kind !== "scenarios") {
    const found = catalogue[kind].find((a) => a.id === id);
    if (!found) throw learningUnavailable();
    return found;
  }
  if (!catalogue.scenarios.some((s) => s.id === id)) throw learningUnavailable();
  const { gate: _gate, ...definition } = practiceDefinitions.find((s) => s.id === id)!;
  if (
    id === "care-triage" &&
    !access.managed &&
    ["ADMIN", "SUPER_ADMIN"].includes(access.role)
  )
    return { ...definition, liveHref: "/admin/support" };
  if (id === "care-triage" && !access.permissions.includes("CUSTOMER_ENQUIRIES"))
    return { ...definition, liveHref: "/admin/workforce/complaints" };
  if (id === "access-review" && !access.managed && access.role === "ADMIN")
    return { ...definition, liveHref: "/admin/staff" };
  return definition;
}
