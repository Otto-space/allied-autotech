import {
  AllieFailure,
  alliePageSchema,
  allieQuestionSchema,
  type AllieCatalogue,
  type AllieHistory,
} from "./allie.contracts.js";
import type { AllieProvider } from "./allie.provider.js";
import { allieSourceSet, retrieveAllieContext } from "./allie.retrieval.js";
import { containsAllieSecret, validateAllieOutput } from "./allie.safety.js";

/** Internal orchestration only. getCatalogue must resolve current server identity,
 * session/MFA, permissions and publication rules on BOTH calls. History must come
 * from the bounded server-owned conversation store, never a client request body.
 * No route exposes this until shared quotas, ownership and expiry are implemented.
 */
export async function answerAllie(input: {
  question: unknown;
  page: unknown;
  previous?: AllieHistory;
  getCatalogue: () => Promise<AllieCatalogue>;
  provider: AllieProvider;
  signal?: AbortSignal;
}) {
  const question = allieQuestionSchema.safeParse(input.question),
    page = alliePageSchema.safeParse(input.page);
  if (!question.success || !page.success || page.data === "security")
    throw new AllieFailure("invalid_input");
  if (containsAllieSecret(question.data)) throw new AllieFailure("sensitive_input");
  if (input.signal?.aborted) throw new AllieFailure("cancelled");
  const catalogue = await input.getCatalogue();
  const context = retrieveAllieContext(
    catalogue,
    question.data,
    page.data,
    input.previous,
  );
  const result = await input.provider.generate(
    question.data,
    page.data,
    context,
    input.signal,
  );
  const current = await input.getCatalogue();
  if (
    current.accessKey !== catalogue.accessKey ||
    allieSourceSet(current) !== context.sourceSet
  )
    throw new AllieFailure("access_changed");
  if (input.signal?.aborted) throw new AllieFailure("cancelled");
  const answer = validateAllieOutput(result.value, context);
  const turns = [
    ...context.history,
    {
      question: question.data,
      answer: [answer.answer, ...answer.steps, answer.caveat ?? ""]
        .filter(Boolean)
        .join("\n"),
      sourceIds: answer.sourceIds,
    },
  ].slice(-6);
  while (
    turns.reduce((sum, turn) => sum + turn.question.length + turn.answer.length, 0) > 8000
  )
    turns.shift();
  return {
    answer,
    usage: result.usage,
    model: result.model,
    durationMs: result.durationMs,
    historyReset: context.historyReset,
    nextHistory: {
      accessKey: current.accessKey,
      sourceSet: context.sourceSet,
      turns,
    } satisfies AllieHistory,
  };
}
