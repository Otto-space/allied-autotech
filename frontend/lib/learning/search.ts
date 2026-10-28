import type { LearningArticle, LearningCatalogue } from "./contracts";

export type LearningMode = "answer" | "guide" | "practice";
export const learningModes = ["answer", "guide", "practice"] as const;
export const learningViews = ["all", ...learningModes] as const;
export type LearningView = (typeof learningViews)[number];
export const assistantName = "Allie"; // Working name; no brand name in contracts/storage.
export const ASSISTANT_VISIBILITY = "aat:learning-visibility";
export const ASSISTANT_HIDDEN_KEY = "aat:learning-hidden:v1";

// Keep the documentation aliases aligned with the backend catalogue search.
export function learningWords(value: string) {
  const aliases: Record<string, string> = {
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
    .map((word) => aliases[word] ?? word);
}
export function matchesLearning(query: string, ...text: string[]) {
  const haystack = learningWords(text.join(" ")).join(" ");
  return learningWords(query.slice(0, 120)).every((word) => haystack.includes(word));
}
export function learningResults(data: LearningCatalogue, query: string) {
  const parent = (id: string) => data.articles.find((a) => a.id === id);
  const parentText = (id: string) => {
    const a = parent(id);
    return a ? [a.title, a.summary, a.keywords].join(" ") : "";
  };
  return [
    ...data.articles
      .filter((a) =>
        matchesLearning(
          query,
          "article answer",
          a.title,
          a.summary,
          a.keywords,
          ...a.steps,
        ),
      )
      .map((a) => ({
        kind: "answer" as const,
        id: a.id,
        articleId: a.id,
        title: a.title,
        summary: a.summary,
        page: a.page,
        count: a.steps.length,
      })),
    ...data.guides
      .filter(
        (g) =>
          data.flags.guides &&
          matchesLearning(
            query,
            "guide walkthrough",
            g.title,
            ...g.steps.map((s) => s.text),
            parentText(g.articleId),
          ),
      )
      .map((g) => ({
        kind: "guide" as const,
        id: g.id,
        articleId: g.articleId,
        title: g.title,
        summary: parent(g.articleId)?.summary ?? "Follow the steps at your own pace.",
        page: g.page,
        count: g.steps.length,
      })),
    ...data.scenarios
      .filter(
        (s) =>
          data.flags.practice &&
          matchesLearning(
            query,
            "practice practise sample",
            s.title,
            s.objective,
            parentText(s.articleId),
          ),
      )
      .map((s) => ({
        kind: "practice" as const,
        id: s.id,
        articleId: s.articleId,
        title: s.title,
        summary: s.objective,
        page: parent(s.articleId)?.page ?? "other",
        count: 0,
      })),
  ];
}
export function learningReturn(
  params: Pick<URLSearchParams, "get">,
  mode?: LearningMode,
) {
  const p = new URLSearchParams();
  const q = (params.get("q") ?? "").slice(0, 120);
  const selected = mode ?? params.get("mode");
  if (q) p.set("q", q);
  if (learningViews.includes(selected as LearningView)) p.set("mode", selected!);
  return "/learn" + (p.size ? "?" + p : "");
}
export function assistantArticles(
  data: LearningCatalogue,
  question: string,
): LearningArticle[] {
  const words = learningWords(question.slice(0, 120));
  if (!words.length) return [];
  return data.articles
    .map((article, index) => {
      const titleWords = learningWords(article.title);
      const title = learningWords(article.title + " " + article.keywords).join(" ");
      const body = learningWords(article.summary + " " + article.steps.join(" ")).join(
        " ",
      );
      const matched = words.filter((word) => title.includes(word) || body.includes(word));
      return {
        article,
        index,
        coverage: matched.length / words.length,
        score:
          matched.length / words.length +
          matched.filter((w) => title.includes(w)).length * 0.1 +
          // A focused task title outranks a broad overview mentioning the same topic.
          words.filter((w) => titleWords.includes(w)).length * 0.2,
        count: matched.length,
      };
    })
    .filter((r) => r.count > 0 && r.coverage >= 0.5)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map((r) => r.article);
}
