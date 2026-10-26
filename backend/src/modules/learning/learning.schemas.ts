import { z } from "zod";
import { learningTargets } from "./learning.content.js";
export const learningQuery = z.strictObject({ q: z.string().trim().max(120).optional() });
export const learningParams = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
});
const text = z.string();
const article = z.object({
  id: text,
  title: text,
  summary: text,
  prerequisites: text,
  steps: z.array(text),
  outcome: text,
  recovery: text,
  keywords: text,
  page: text,
  href: text,
  source: text,
  version: z.number().int(),
  status: z.literal("published"),
  reviewedAt: text,
});
const guide = z.object({
  id: text,
  title: text,
  version: z.number().int(),
  articleId: text,
  page: text,
  href: text,
  steps: z.array(
    z.object({
      id: text,
      target: z.enum(learningTargets),
      text,
      event: z.enum(["input", "click", "read"]),
    }),
  ),
});
const scenarioSummary = z.object({
  id: text,
  title: text,
  version: z.number().int(),
  articleId: text,
  objective: text,
});
const scenario = scenarioSummary.extend({
  kind: z.enum(["fitment", "draft", "decision"]),
  fields: z.array(
    z.object({
      id: text,
      label: text,
      example: text,
      min: z.number(),
      max: z.number(),
      options: z.array(text).optional(),
      dependsOn: text.optional(),
    }),
  ),
  choices: z.array(z.object({ id: text, label: text, feedback: text })),
  expected: text,
  outcome: text,
  liveHref: text,
});
export const learningResponseSchemas = {
  catalogue: z.object({
    accessKey: text,
    audience: z.enum(["public", "customer", "work"]),
    contentVersion: z.literal(1),
    mode: z.enum(["full", "browse_enquiries", "catalogue"]),
    flags: z.object({ guides: z.boolean(), practice: z.boolean(), ai: z.literal(false) }),
    articles: z.array(article),
    guides: z.array(guide),
    scenarios: z.array(scenarioSummary),
  }),
  articles: article,
  guides: guide,
  scenarios: scenario,
};
