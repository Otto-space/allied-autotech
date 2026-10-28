import { createHash } from "node:crypto";
import {
  AllieFailure,
  type AllieAction,
  type AllieCatalogue,
  type AllieContext,
  type AllieHistory,
  type AlliePage,
  type AllieSource,
} from "./allie.contracts.js";
import { alliePlainText, containsAllieSecret } from "./allie.safety.js";

const destinations = new Set([
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
  "/admin/workforce/bookings",
  "/admin/workforce/aftercare",
  "/admin/workforce/access",
  "/admin/staff",
  "/admin/customers",
  "/admin/security",
  "/admin/support",
  "/admin/refunds",
  "/admin/payment-disputes/work",
  "/admin/privacy",
  "/admin/finance-policy",
]);
const aliases: Record<string, string> = {
  shop: "part",
  parts: "part",
  products: "part",
  product: "part",
  spares: "part",
  fitment: "compatibility",
  fits: "compatibility",
  compatible: "compatibility",
  images: "image",
  photos: "image",
  photo: "image",
  gallery: "image",
  support: "care",
  complaint: "care",
  complaints: "care",
  enquiries: "enquiry",
  appointment: "booking",
  reserve: "reservation",
  car: "vehicle",
  cars: "vehicle",
  login: "access",
  signin: "access",
  permissions: "permission",
  roles: "role",
  duties: "responsibility",
  responsibilities: "responsibility",
  delegate: "permission",
  delegation: "permission",
  delegating: "permission",
  authority: "permission",
  privilege: "permission",
  privileges: "permission",
  practise: "practice",
  cash: "payment",
  payments: "payment",
  checkout: "payment",
  quotation: "quote",
  password: "recovery",
};
function words(value: string) {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}-]+/u)
    .filter(
      (word) =>
        word &&
        !/^(how|do|does|i|can|my|your|what|is|the|a|an|to|me|please|with|it|that|this|where|step|explain|more|and|you|for|of|in|on|am|are)$/.test(
          word,
        ),
    )
    .map((word) => aliases[word] ?? word);
}
function near(a: string, b: string) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    differences = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++differences > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return differences + Number(i < a.length || j < b.length) <= 1;
}
export function allieSourceSet(catalogue: AllieCatalogue) {
  // Body and action changes invalidate history even if an editor forgot a version bump.
  return createHash("sha256")
    .update(
      JSON.stringify({
        audience: catalogue.audience,
        mode: catalogue.mode,
        flags: catalogue.flags,
        articles: [...catalogue.articles].sort((a, b) => a.id.localeCompare(b.id)),
        guides: [...catalogue.guides].sort((a, b) => a.id.localeCompare(b.id)),
        scenarios: [...catalogue.scenarios].sort((a, b) => a.id.localeCompare(b.id)),
      }),
    )
    .digest("hex");
}
const sourceId = (article: AllieCatalogue["articles"][number]) =>
  `${article.id}@v${article.version}`;

export function retrieveAllieContext(
  catalogue: AllieCatalogue,
  question: string,
  page: AlliePage,
  previous?: AllieHistory,
): AllieContext {
  const sourceSet = allieSourceSet(catalogue);
  const safeArticles = catalogue.articles.filter(
    (article) =>
      article.status === "published" &&
      /^[a-z][a-z0-9-]{0,63}$/.test(article.id) &&
      destinations.has(article.href) &&
      Number.isInteger(article.version) &&
      article.version > 0,
  );
  const ids = new Set(safeArticles.map(sourceId));
  const validHistory =
    previous?.accessKey === catalogue.accessKey &&
    previous.sourceSet === sourceSet &&
    previous.turns.length <= 6 &&
    previous.turns.every(
      (turn) =>
        turn.question.length <= 1200 &&
        turn.answer.length <= 4000 &&
        alliePlainText(turn.answer) &&
        !containsAllieSecret(turn.question) &&
        turn.sourceIds.length <= 4 &&
        turn.sourceIds.every((id) => ids.has(id)),
    ) &&
    previous.turns.reduce(
      (sum, turn) => sum + turn.question.length + turn.answer.length,
      0,
    ) <= 8000;
  const history = validHistory ? previous!.turns : [];
  const latest = history.at(-1);
  const query = [...new Set(words(question))].slice(0, 40);
  const followUp =
    /\b(?:it|that|this|step|again|more|shorter|longer|expand|explain|where|try)\b/i.test(
      question,
    );
  const matches = safeArticles
    .map((article) => {
      const titles = words(`${article.id} ${article.title} ${article.keywords}`);
      const body = words(
        `${article.summary} ${article.prerequisites} ${article.steps.join(" ")}`,
      );
      let score = query.reduce(
        (sum, word) =>
          sum +
          (titles.includes(word)
            ? 7
            : titles.some((candidate) => near(word, candidate))
              ? 4
              : body.includes(word)
                ? 2
                : 0),
        0,
      );
      if (followUp && latest?.sourceIds.includes(sourceId(article))) score += 10;
      if (article.page === page && page !== "other" && page !== "work") score += 1;
      return { article, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id));
  const sources: AllieSource[] = [];
  let budget = 8000;
  for (const { article } of matches.slice(0, 4)) {
    const passage = [
      article.summary,
      article.prerequisites,
      ...article.steps.map((step, index) => `${index + 1}. ${step}`),
      article.outcome,
      article.recovery,
    ].join("\n");
    // Do not truncate away a restriction or emit a partial passage.
    if (passage.length > budget || containsAllieSecret(passage)) continue;
    budget -= passage.length;
    sources.push({
      id: sourceId(article),
      articleId: article.id,
      version: article.version,
      title: article.title,
      href: `/learn?article=${article.id}`,
      passage,
    });
  }
  const actions: AllieAction[] = [];
  for (const source of sources) {
    const article = safeArticles.find((entry) => entry.id === source.articleId)!;
    actions.push({
      id: `read:${article.id}`,
      kind: "article",
      label: `Read ${article.title}`,
      href: source.href,
      sourceId: source.id,
    });
    actions.push({
      id: `open:${article.id}`,
      kind: "navigate",
      label: `Open ${article.title}`,
      href: article.href,
      sourceId: source.id,
    });
    if (catalogue.flags.guides)
      for (const guide of catalogue.guides.filter(
        (g) => g.articleId === article.id && destinations.has(g.href),
      )) {
        if (!/^[a-z][a-z0-9-]{0,63}$/.test(guide.id)) continue;
        actions.push({
          id: `guide:${guide.id}`,
          kind: "guide",
          label: guide.title,
          href: `${guide.href}#learn=${guide.id}`,
          sourceId: source.id,
        });
      }
    if (catalogue.flags.practice)
      for (const scenario of catalogue.scenarios.filter(
        (s) => s.articleId === article.id,
      )) {
        if (!/^[a-z][a-z0-9-]{0,63}$/.test(scenario.id)) continue;
        actions.push({
          id: `practice:${scenario.id}`,
          kind: "practice",
          label: scenario.title,
          href: `/learn/practice/${scenario.id}`,
          sourceId: source.id,
        });
      }
  }
  if (catalogue.audience !== "work")
    actions.push({
      id: "human:care",
      kind: "human",
      label: "Contact Customer Care",
      href: catalogue.audience === "customer" ? "/dashboard/support" : "/contact",
      sourceId: null,
    });
  if (new Set(actions.map((action) => action.id)).size !== actions.length)
    throw new AllieFailure("invalid_output");
  return {
    audience: catalogue.audience,
    releaseMode: catalogue.mode,
    sourceSet,
    sources,
    actions,
    history,
    historyReset: !!previous && !validHistory,
  };
}
