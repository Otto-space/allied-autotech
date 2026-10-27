// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { practiceSchema } from "@/lib/learning/contracts";
import { createPracticeAdapter } from "@/lib/learning/practice-adapter";
import {
  clearLearningProgress,
  loadLearningProgress,
  saveLearningProgress,
} from "@/lib/learning/progress";
const definition = practiceSchema.parse({
  id: "sample",
  articleId: "sample",
  title: "Synthetic only",
  objective: "Synthetic only",
  version: 1,
  kind: "draft",
  fields: [
    {
      id: "make",
      label: "Make",
      min: 2,
      max: 20,
      example: "Toyota",
      options: ["Toyota"],
    },
    {
      id: "model",
      label: "Model",
      min: 2,
      max: 20,
      example: "Corolla",
      options: ["Corolla"],
      dependsOn: "make",
    },
    {
      id: "year",
      label: "Year",
      min: 4,
      max: 4,
      example: "2018",
      options: ["2018"],
      dependsOn: "model",
    },
  ],
  choices: [
    { id: "review", label: "Review", feedback: "Reviewed locally" },
    { id: "unsafe", label: "Assume", feedback: "Try again" },
  ],
  expected: "review",
  outcome: "Nothing sent",
  liveHref: "/parts",
});
describe("practice isolation and transitions", () => {
  it("searches only fictional fixtures, distinguishes outcomes and invalidates stale results", () => {
    const fitment = {
      ...definition,
      kind: "fitment" as const,
      fields: [
        ...definition.fields,
        { id: "query", label: "Part search", min: 2, max: 100, example: "Brake pads" },
      ],
    };
    const a = createPracticeAdapter(fitment, "local");
    a.execute({ type: "example", replace: false });
    expect(a.execute({ type: "review", choice: "review" }).completed).toBe(false);
    expect(a.execute({ type: "search" }).results?.map((part) => part.status)).toEqual([
      "Compatible",
      "Incompatible",
      "Not confirmed",
    ]);
    expect(a.execute({ type: "review", choice: "review" }).completed).toBe(true);
    a.execute({ type: "edit", field: "query", value: "No matching fictional part" });
    expect(a.snapshot().results).toBeNull();
    expect(a.snapshot().completed).toBe(false);
    expect(a.execute({ type: "search" }).results).toEqual([]);
    expect(() =>
      createPracticeAdapter(definition, "draft").execute({ type: "search" }),
    ).toThrow();
  });
  it("requires validation and deliberate review; example remains editable", () => {
    const a = createPracticeAdapter(definition, "one");
    const errors = a.execute({ type: "review", choice: "" }).errors;
    expect(errors.make).toBe("Choose make from the available examples.");
    expect(errors.year).toBe("Choose year from the available examples.");
    expect(a.execute({ type: "example", replace: false }).completed).toBe(false);
    expect(a.execute({ type: "review", choice: "unsafe" }).completed).toBe(false);
    expect(a.execute({ type: "review", choice: "review" }).completed).toBe(true);
    expect(a.snapshot().progress).toMatchObject({
      id: "sample",
      version: 1,
      step: 1,
      status: "completed",
    });
    expect(
      a.execute({ type: "edit", field: "model", value: "" }).values.year,
    ).toBeUndefined();
    expect(a.snapshot().completed).toBe(false);
  });
  it("protects existing entries, dependent choices, foreign resets and unknown live IDs", () => {
    const a = createPracticeAdapter(definition, "one"),
      b = createPracticeAdapter(definition, "two");
    a.execute({ type: "example", replace: false });
    expect(() => a.execute({ type: "example", replace: false })).toThrow(/replacement/);
    expect(() => a.execute({ type: "reset", nonce: "two" })).toThrow();
    expect(() =>
      a.execute({ type: "reset", nonce: "one", realId: "live-record" } as never),
    ).toThrow();
    expect(() => a.execute({ type: "edit", field: "userId", value: "live" })).toThrow();
    expect(() =>
      a.execute({ type: "edit", field: "make", value: "unapproved" }),
    ).toThrow();
    const snapshot = a.snapshot();
    snapshot.values.make = "tampered";
    expect(a.snapshot().values.make).toBe("Toyota");
    a.execute({ type: "edit", field: "make", value: "" });
    expect(a.snapshot().values).toEqual({ make: "" });
    a.execute({ type: "reset", nonce: "one" });
    expect(b.snapshot().values).toEqual({});
  });
});
describe("private minimal learning progress", () => {
  const owner = "a".repeat(64),
    other = "b".repeat(64),
    value = {
      id: "sample",
      version: 1,
      step: 1,
      status: "paused" as const,
      lastActivity: 123,
    };
  beforeEach(() => sessionStorage.clear());
  it("isolates identities and requires restart for a changed definition", () => {
    expect(saveLearningProgress(owner, value)).toBe(true);
    expect(loadLearningProgress(other, "sample", 1)).toBeNull();
    expect(loadLearningProgress(owner, "sample", 2)).toBe("restart");
    expect(
      saveLearningProgress(owner, { ...value, formValues: "private" } as never),
    ).toBe(false);
    expect(JSON.stringify(sessionStorage)).not.toContain("private");
  });
  it("clears only learning metadata and tolerates malformed progress", () => {
    sessionStorage.setItem("unrelated-live-draft", "preserve");
    saveLearningProgress(owner, value);
    clearLearningProgress();
    expect(loadLearningProgress(owner, "sample", 1)).toBeNull();
    expect(sessionStorage.getItem("unrelated-live-draft")).toBe("preserve");
    sessionStorage.setItem(
      "aat:learning-progress:v1:" + owner + ":sample",
      "broken-json",
    );
    expect(loadLearningProgress(owner, "sample", 1)).toBeNull();
  });
});
