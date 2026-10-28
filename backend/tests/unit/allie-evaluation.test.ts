import { describe, expect, it, vi } from "vitest";
import { evaluationCases } from "../../scripts/allie-evaluation-cases.js";
import {
  evaluationAdmissionDelay,
  evaluationBudgetAllows,
  evaluationRequestReserve,
} from "../../scripts/allie-evaluation-limits.js";
import { answerAllie } from "../../src/modules/learning/allie.answer.js";
import { createAllieProvider } from "../../src/modules/learning/allie.provider.js";

describe("bounded isolated evaluation", () => {
  it("retains 100 distinct provider scenarios and ten local negative cases", () => {
    expect(evaluationCases).toHaveLength(110);
    expect(new Set(evaluationCases.map((c) => c.question)).size).toBe(110);
    expect(evaluationCases.filter((c) => !c.failure)).toHaveLength(100);
    expect(new Set(evaluationCases.map((c) => c.persona)).size).toBe(16);
    expect(evaluationCases.every((c) => c.rubric.length > 30)).toBe(true);
  });
  it("reserves uncached byte-based cost and the entire output bound", () => {
    expect(evaluationRequestReserve(1000)).toEqual({ tokens: 4248, usd: 0.0009048 });
    expect(() => evaluationRequestReserve(0)).toThrow();
    expect(() => evaluationRequestReserve(Infinity)).toThrow();
  });
  it("never raises the lower owner cap or the US$1 local cap", () => {
    expect(evaluationBudgetAllows(119, 0.1, 120, 5, 0.001)).toBe(true);
    expect(evaluationBudgetAllows(120, 0.1, 120, 5, 0.001)).toBe(false);
    expect(evaluationBudgetAllows(1, 0.999, 120, 5, 0.002)).toBe(false);
    expect(evaluationBudgetAllows(1, 0.009, 120, 0.01, 0.002)).toBe(false);
    expect(evaluationBudgetAllows(0, 0, 121, 5, 0.001)).toBe(false);
    expect(evaluationBudgetAllows(0, NaN, 120, 5, 0.001)).toBe(false);
  });
  it("holds admission for RPM, TPM and subsecond bursts, then releases expired reservations", () => {
    const now = 100000;
    expect(evaluationAdmissionDelay(now, now - 7000, [], 10000)).toBe(0);
    expect(evaluationAdmissionDelay(now, now - 1000, [], 10000)).toBe(1000);
    expect(
      evaluationAdmissionDelay(
        now,
        now - 7000,
        Array.from({ length: 9 }, () => ({ at: now - 8000, tokens: 1 })),
        1,
      ),
    ).toBe(1000);
    expect(
      evaluationAdmissionDelay(
        now,
        now - 7000,
        [{ at: now - 8000, tokens: 50000 }],
        10000,
      ),
    ).toBe(1000);
    expect(
      evaluationAdmissionDelay(
        now,
        now - 7000,
        [{ at: now - 61000, tokens: 50000 }],
        10000,
      ),
    ).toBe(0);
    expect(() => evaluationAdmissionDelay(now, 0, [], 54001)).toThrow();
  });
  it.each(evaluationCases.filter((c) => !!c.failure))(
    "rejects $id without catalogue or outbound access",
    async (c) => {
      const request = vi.fn<typeof fetch>(),
        getCatalogue = vi.fn(async () => {
          throw new Error("Catalogue must not be read");
        });
      await expect(
        answerAllie({
          question: c.question,
          page: c.page,
          getCatalogue,
          provider: createAllieProvider(
            { apiKey: "synthetic-test-key-never-used", model: "synthetic-model" },
            request,
          ),
        }),
      ).rejects.toMatchObject({ code: c.failure });
      expect(request).not.toHaveBeenCalled();
      expect(getCatalogue).not.toHaveBeenCalled();
    },
  );
});
