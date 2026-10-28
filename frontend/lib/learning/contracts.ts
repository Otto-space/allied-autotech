import { z } from "zod";
import { matchesLearning } from "./search";
export const learningEnabled = () =>
  process.env.NEXT_PUBLIC_HELP_LEARN_ENABLED === "true";
const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const text = z.string().max(8000);
export const learningHref = z.enum([
  "/parts",
  "/vehicles",
  "/services",
  "/help",
  "/forgot-password",
  "/dashboard/support",
  "/admin",
  "/admin/workforce/enquiries",
  "/admin/workforce/complaints",
  "/admin/workforce/jobs",
  "/admin/workforce/finance",
  "/admin/workforce/access",
  "/admin/staff",
  "/admin/customers",
  "/admin/security",
  "/admin/support",
]);
export const articleSchema = z.object({
  id,
  title: text,
  summary: text,
  prerequisites: text,
  steps: z.array(text).max(12),
  outcome: text,
  recovery: text,
  keywords: text,
  page: text,
  href: learningHref,
  source: text,
  version: z.number().int().positive(),
  status: z.literal("published"),
  reviewedAt: text,
});
export const targetSchema = z.enum([
  "parts-search",
  "parts-results",
  "support-start",
  "support-subject",
  "care-search",
  "care-results",
]);
export const guideSchema = z.object({
  id,
  version: z.number().int().positive(),
  title: text,
  articleId: id,
  page: text,
  href: learningHref,
  steps: z
    .array(
      z.object({
        id,
        target: targetSchema,
        text,
        event: z.enum(["input", "click", "read"]),
      }),
    )
    .min(1)
    .max(12),
});
const scenarioSummary = z.object({
  id,
  title: text,
  version: z.number().int().positive(),
  articleId: id,
  objective: text,
});
export const catalogueSchema = z.object({
  accessKey: z.string().regex(/^[a-f0-9]{64}$/),
  audience: z.enum(["public", "customer", "work"]),
  contentVersion: z.literal(1),
  mode: z.enum(["full", "browse_enquiries", "catalogue"]),
  flags: z.object({ guides: z.boolean(), practice: z.boolean(), ai: z.boolean() }),
  articles: z.array(articleSchema).max(40),
  guides: z.array(guideSchema).max(20),
  scenarios: z.array(scenarioSummary).max(30),
});
export const practiceSchema = scenarioSummary.extend({
  kind: z.enum(["fitment", "draft", "decision"]),
  fields: z
    .array(
      z.object({
        id,
        label: text,
        example: text,
        min: z.number().int().nonnegative(),
        max: z.number().int().positive().max(1000),
        options: z.array(z.string().max(120)).max(30).optional(),
        dependsOn: id.optional(),
      }),
    )
    .max(8),
  choices: z
    .array(z.object({ id, label: text, feedback: text }))
    .min(2)
    .max(6),
  expected: id,
  outcome: text,
  liveHref: learningHref,
});
export type LearningCatalogue = z.infer<typeof catalogueSchema>;
export type LearningGuide = z.infer<typeof guideSchema>;
export type LearningArticle = z.infer<typeof articleSchema>;
export type PracticeDefinition = z.infer<typeof practiceSchema>;
export function learningPage(path: string) {
  if (
    /^\/(?:login|register|mfa|forgot-password|reset-password|verify-email)(?:\/|$)/.test(
      path,
    ) ||
    /^\/(?:dashboard|admin|staff)\/security(?:\/|$)/.test(path)
  )
    return "security";
  if (path === "/") return "home";
  if (path === "/parts") return "parts";
  if (path === "/vehicles") return "vehicles";
  if (["/services", "/contact", "/help", "/learn"].includes(path)) return path.slice(1);
  if (/^\/dashboard\/support(?:\/|$)/.test(path)) return "customer-care";
  if (/^\/admin\/(?:workforce\/(?:enquiries|complaints)|support)(?:\/|$)/.test(path))
    return "staff-care";
  if (/^\/(?:admin|staff)(?:\/|$)/.test(path)) return "work";
  return "other";
}
export function learningMatches(article: LearningArticle, query: string) {
  return matchesLearning(
    query,
    article.title,
    article.summary,
    article.keywords,
    ...article.steps,
  );
}
