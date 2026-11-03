import { getPublicCapabilities } from "@/lib/api/public-capabilities-server";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { publicData } from "@/lib/api/public-server";
import { parseServiceDiscovery } from "@/lib/api/public-schemas";
import { parseProductDiscovery } from "@/lib/api/commerce-schemas";
import { parseVehicleDiscovery } from "@/lib/api/vehicle-schemas";
import { getFaqs } from "@/lib/business";
import { catalogueSchema, learningEnabled } from "@/lib/learning/contracts";
import styles from "./search.module.css";
import { RetrySearch } from "./retry-search";

type Entry = {
  title: string;
  href: string;
  detail?: string;
  reference?: string;
  partNumber?: string;
};
type EntryBatch = { entries: Entry[]; partial: boolean };
async function additionalHelp(): Promise<EntryBatch> {
  if (!learningEnabled()) return { entries: [], partial: false };
  try {
    const catalogue = await publicData(
      "/public/learning/catalogue?destinationsVersion=2",
      (value) => {
        const result = catalogueSchema.parse(value);
        if (result.audience !== "public") throw Error("Public guidance unavailable");
        return result;
      },
    );
    return {
      entries: catalogue.articles.map((article) => ({
        title: article.title,
        detail: article.summary,
        href: `/learn?article=${article.id}`,
      })),
      partial: false,
    };
  } catch (error) {
    unstable_rethrow(error);
    return { entries: [], partial: true };
  }
}
export async function SearchResults({
  query,
  helpOnly,
}: {
  query: string;
  helpOnly: boolean;
}) {
  const faqs = getFaqs(await getPublicCapabilities());
  const params = new URLSearchParams({ search: query, limit: "5" });
  const help = async (): Promise<EntryBatch> => {
    const additional = await additionalHelp();
    const entries: Entry[] = [
      ...faqs.map((faq) => ({
        title: faq.question,
        detail: faq.answer,
        href: `/help/${faq.id}`,
      })),
      ...additional.entries,
    ];
    const term = query.toLocaleLowerCase();
    return {
      entries: entries.filter((entry) =>
        `${entry.title} ${entry.detail}`.toLocaleLowerCase().includes(term),
      ),
      partial: additional.partial,
    };
  };
  const groups: {
    name: string;
    href: string;
    read: () => Promise<Entry[] | EntryBatch>;
  }[] = [
    ...(!helpOnly
      ? [
          {
            name: "Services",
            href: `/services?search=${encodeURIComponent(query)}`,
            read: async () =>
              (
                await publicData(
                  `/public/services/discovery?${params}`,
                  parseServiceDiscovery,
                )
              ).items.map((row) => ({
                title: row.name,
                detail: row.shortDescription ?? undefined,
                href: `/services/${row.id}`,
              })),
          },
          {
            name: "Shop",
            href: `/parts?search=${encodeURIComponent(query)}`,
            read: async () =>
              (
                await publicData(
                  `/public/catalog/products/discovery?${params}`,
                  parseProductDiscovery,
                )
              ).items.map((row) => ({
                title: row.name,
                reference: row.sku,
                partNumber: row.manufacturerPartNumber ?? undefined,
                detail:
                  [
                    row.brand,
                    row.manufacturerPartNumber
                      ? `Part no. ${row.manufacturerPartNumber}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ? ") || undefined,
                href: `/parts/${row.id}`,
              })),
          },
          {
            name: "Vehicles",
            href: `/vehicles?search=${encodeURIComponent(query)}`,
            read: async () =>
              (
                await publicData(
                  `/public/vehicles/discovery?${params}`,
                  parseVehicleDiscovery,
                )
              ).items.map((row) => ({ title: row.title, href: `/vehicles/${row.id}` })),
          },
        ]
      : []),
    { name: "Help", href: `/help?q=${encodeURIComponent(query)}`, read: help },
  ];
  const results = await Promise.allSettled(
    groups.map(async (group) => {
      const result = await group.read();
      return Array.isArray(result) ? { entries: result, partial: false } : result;
    }),
  );
  const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();
  const term = normalize(query);
  const rank = (entry: Entry) =>
    [entry.title, entry.reference ?? "", entry.partNumber ?? ""].some(
      (text) => normalize(text) === term,
    )
      ? 0
      : normalize(entry.title).startsWith(term)
        ? 1
        : 2;
  return (
    <div className={styles.results} aria-label="Public search results">
      <h2>Results for “{query}”</h2>
      <p>Public results only. Your private records are not searched.</p>
      {groups
        .map((group, index) => ({ group, index }))
        .sort((a, b) => {
          const empty = (index: number) => {
            const result = results[index];
            return result.status === "fulfilled" &&
              !result.value.entries.length &&
              !result.value.partial
              ? 1
              : 0;
          };
          return empty(a.index) - empty(b.index);
        })
        .map(({ group, index }) => {
          const result = results[index];
          if (result.status === "rejected") unstable_rethrow(result.reason);
          const additionalHelpUnavailable =
            group.name === "Help" &&
            result.status === "fulfilled" &&
            result.value.partial;
          if (
            result.status === "fulfilled" &&
            !result.value.entries.length &&
            !result.value.partial
          )
            return (
              <details key={group.name} className={styles.emptyResults}>
                <summary>{group.name}: no matches</summary>
                <p>No {group.name.toLowerCase()} results found.</p>
                <Link className="text-link" href={group.href}>
                  View all {group.name.toLowerCase()} results
                </Link>
              </details>
            );
          return (
            <section key={group.name} aria-label={`${group.name} search results`}>
              <h3>{group.name}</h3>
              {group.name === "Help" && additionalHelpUnavailable && (
                <p role="status">
                  More Help &amp; Learn results are temporarily unavailable.{" "}
                  <RetrySearch />
                </p>
              )}
              {result.status === "rejected" ? (
                <p role="status">
                  {group.name} results are temporarily unavailable. <RetrySearch />
                </p>
              ) : result.value.entries.length ? (
                <ul>
                  {[...result.value.entries]
                    .sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title))
                    .slice(0, 5)
                    .map((entry) => (
                      <li key={entry.href}>
                        <Link href={entry.href}>{entry.title}</Link>
                        {entry.detail && <p>{entry.detail}</p>}
                      </li>
                    ))}
                </ul>
              ) : (
                <p>
                  {group.name === "Help" && additionalHelpUnavailable
                    ? "No matching FAQs found."
                    : `No ${group.name.toLowerCase()} results found.`}
                </p>
              )}
              <Link className="text-link" href={group.href}>
                View all {group.name.toLowerCase()} results
              </Link>
            </section>
          );
        })}
    </div>
  );
}
