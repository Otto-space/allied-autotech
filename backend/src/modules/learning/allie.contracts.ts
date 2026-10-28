import { z } from "zod";
import type { learningCatalogue } from "./learning.service.js";

// Internal server boundary. No request handler accepts a catalogue, history,
// access key or source text from a browser. The server conversation store owns these.
export type AllieCatalogue = ReturnType<typeof learningCatalogue>;
export const alliePageSchema = z.enum([
  "home",
  "parts",
  "vehicles",
  "services",
  "contact",
  "help",
  "learn",
  "customer-care",
  "staff-care",
  "work",
  "security",
  "other",
]);
export type AlliePage = z.infer<typeof alliePageSchema>;
export const allieQuestionSchema = z.string().trim().min(1).max(1200);
const plainText = z.string().trim().max(2400);
export const allieOutputSchema = z.strictObject({
  kind: z.enum(["answer", "clarification", "unavailable", "human"]),
  answer: plainText.min(1),
  steps: z.array(z.string().trim().min(1).max(400)).max(6),
  caveat: z.string().trim().min(1).max(500).nullable(),
  sourceIds: z.array(z.string().max(100)).max(4),
  actionIds: z.array(z.string().max(120)).max(3),
});
export type AllieModelOutput = z.infer<typeof allieOutputSchema>;
export type AllieHistory = {
  accessKey: string;
  sourceSet: string;
  turns: {
    question: string;
    answer: string;
    sourceIds: string[];
  }[];
};
export type AllieSource = {
  id: string;
  articleId: string;
  version: number;
  title: string;
  href: string;
  passage: string;
};
export type AllieAction = {
  id: string;
  kind: "article" | "guide" | "practice" | "navigate" | "human";
  label: string;
  href: string;
  sourceId: string | null;
};
export type AllieContext = {
  audience: AllieCatalogue["audience"];
  releaseMode: AllieCatalogue["mode"];
  sourceSet: string;
  sources: AllieSource[];
  actions: AllieAction[];
  history: AllieHistory["turns"];
  historyReset: boolean;
};
export type AllieFailureCode =
  | "invalid_input"
  | "sensitive_input"
  | "access_changed"
  | "not_configured"
  | "provider_unavailable"
  | "provider_quota"
  | "invalid_output"
  | "cancelled";
export class AllieFailure extends Error {
  constructor(readonly code: AllieFailureCode) {
    // Never attach provider bodies, prompts, credentials or transport exception text.
    super("Allie could not complete this answer");
    this.name = "AllieFailure";
  }
}

export const allieJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["answer", "clarification", "unavailable", "human"] },
    answer: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
    caveat: { type: ["string", "null"] },
    sourceIds: { type: "array", items: { type: "string" } },
    actionIds: { type: "array", items: { type: "string" } },
  },
  required: ["kind", "answer", "steps", "caveat", "sourceIds", "actionIds"],
} as const;
