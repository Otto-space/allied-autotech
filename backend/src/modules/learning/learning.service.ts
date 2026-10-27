import { createHash } from "node:crypto";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { AppError } from "../../common/errors/app-error.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import { workforceSnapshot } from "../organization/workforce.policy.js";
import { careBranchesFor } from "../organization/workforce-care-scope.js";
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
  independentCapabilities?: readonly string[];
  position: string | null;
  canManage: boolean;
  salesScope?: "assigned" | "branch" | "mixed";
  careScope?: {
    enquiries: boolean;
    complaints: boolean;
    reply: boolean;
    assign: boolean;
  };
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
  const independent = (permission: string) =>
    access.independentCapabilities?.includes(permission) ?? false;
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
      return (
        work &&
        (globalAdmin ||
          can("CUSTOMER_ENQUIRIES") ||
          can("COMPLAINTS") ||
          can("CARE_CASE_VIEW"))
      );
    case "sales":
      return work && can("SALES_ENQUIRIES");
    case "finance":
      return work && can("FINANCE_READ");
    case "refunds":
      return (
        work && ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"].some(independent)
      );
    case "disputes":
      return work && independent("DISPUTE_MANAGE");
    case "privacy":
      return work && independent("PRIVACY_REVIEW");
    case "financial-policy":
      return work && independent("FINANCE_POLICY_APPROVE");
    case "booking-confirmation":
      return work && can("BOOKINGS_READ") && independent("BOOKING_CONFIRM");
    case "financial-aftercare":
      return (
        work &&
        access.managed &&
        can("FINANCE_READ") &&
        independent("FINANCE_POLICY_APPROVE")
      );
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
  const salesScopes = new Set(
    snapshot.capabilityScopes
      .filter((row) => row.capability === "SALES_ENQUIRIES")
      .map((row) => row.scope),
  );
  return {
    role: actor.role,
    verified: true,
    managed: snapshot.managed,
    permissions: snapshot.permissions,
    independentCapabilities: snapshot.independentCapabilities,
    position: snapshot.position,
    canManage: snapshot.canManageAssignments,
    careScope: {
      enquiries: careBranchesFor(snapshot, "ENQUIRY").length > 0,
      complaints: careBranchesFor(snapshot, "COMPLAINT").length > 0,
      reply:
        careBranchesFor(snapshot, "ENQUIRY", "reply").length > 0 ||
        careBranchesFor(snapshot, "COMPLAINT", "reply").length > 0,
      assign:
        careBranchesFor(snapshot, "ENQUIRY", "assign").length > 0 ||
        careBranchesFor(snapshot, "COMPLAINT", "assign").length > 0,
    },
    ...(salesScopes.size
      ? {
          salesScope:
            salesScopes.size > 1
              ? ("mixed" as const)
              : salesScopes.has("BRANCH")
                ? ("branch" as const)
                : ("assigned" as const),
        }
      : {}),
    key: createHash("sha256")
      .update(
        JSON.stringify([
          actor.userId,
          actor.sessionId,
          actor.role,
          snapshot.version,
          snapshot.accessRevision,
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
  const careReply =
    access.careScope?.reply ??
    access.permissions.some((p) => ["CUSTOMER_ENQUIRIES", "COMPLAINTS"].includes(p));
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
      let projected = a;
      if (a.id === "care-triage" && access.managed) {
        const reply = careReply;
        projected = {
          ...a,
          summary: reply
            ? "Read the case in your current branch scope. Reply only where current view and reply duties overlap on that branch."
            : "Read the cases in your current branch scope. Your current duties do not permit customer replies.",
          steps: a.steps.map((step, index) =>
            index === 2
              ? reply
                ? "Your managed Customer Care workspace provides customer-visible replies only where current view and reply authority overlap, and does not provide internal notes. Never put internal information in a customer reply. Review the audience before sending."
                : "Your current managed Customer Care view does not permit replies and does not provide internal notes. No reply editor is available in a view-only case."
              : index === 3 && !reply
                ? "Continue reading the permitted conversation and current status. Ask an authorised manager to review duties if you need to reply; a position title cannot grant that action."
                : step,
          ),
        };
        if (access.careScope?.assign)
          projected = {
            ...projected,
            steps: [
              ...projected.steps,
              "For an available assignment action, choose a current eligible colleague in the same branch, enter the internal assignment reason and review the exact change. Assignment does not send that reason as a customer reply.",
            ],
          };
        projected = {
          ...projected,
          steps: [
            ...projected.steps,
            "These duties do not establish staffed live chat. Use the existing case queue; live acceptance also requires a separately enabled staffed service.",
          ],
        };
      }
      if (a.id === "sales-enquiries" && access.salesScope) {
        projected = {
          ...projected,
          summary:
            access.salesScope === "assigned"
              ? "Only enquiries assigned to you within your authorised scope are available. This does not grant branch-wide enquiry access."
              : access.salesScope === "branch"
                ? "Only enquiries within your authorised branch scope are available; this is not global enquiry access."
                : "Sales scope differs by grant and branch. Use only records returned by your authorised queue; an assigned-only grant does not become branch-wide because of a grant elsewhere.",
        };
      }
      // Complaint-only officers must not be directed to an unavailable enquiry queue.
      if (
        a.id === "care-triage" &&
        !access.managed &&
        ["ADMIN", "SUPER_ADMIN"].includes(access.role)
      )
        return { ...projected, href: "/admin/support" };
      if (
        a.id === "care-triage" &&
        !access.permissions.some((p) =>
          ["CUSTOMER_ENQUIRIES", "CARE_CASE_VIEW"].includes(p),
        )
      )
        return { ...projected, href: "/admin/workforce/complaints" };
      if (a.id === "access-review" && !access.managed && access.role === "ADMIN")
        return { ...projected, href: "/admin/staff" };
      return projected;
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
                !access.permissions.some((p) =>
                  ["CUSTOMER_ENQUIRIES", "CARE_CASE_VIEW"].includes(p),
                )
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
              !(s.id === "care-triage" && access.managed && !careReply) &&
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
  if (
    id === "care-triage" &&
    !access.permissions.some((p) => ["CUSTOMER_ENQUIRIES", "CARE_CASE_VIEW"].includes(p))
  )
    return { ...definition, liveHref: "/admin/workforce/complaints" };
  if (id === "access-review" && !access.managed && access.role === "ADMIN")
    return { ...definition, liveHref: "/admin/staff" };
  return definition;
}
