import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { publicSearchScopes, resolvePublicSearch } from "@/lib/public-search";
import styles from "./search.module.css";

export const metadata: Metadata = {
  title: "Search Allied AutoTech",
  description: "Find published services, parts and vehicle listings.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string | string[]; search?: string | string[] }>;
}) {
  const result = resolvePublicSearch(await searchParams);
  if (result.href) redirect(result.href);
  return (
    <>
      <SiteHeader />
      <main id="main" className={`public-site ${styles.page}`}>
        <div className={styles.content}>
          <nav aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-current="page">Search</span>
          </nav>
          <h1>What are you looking for?</h1>
          <p>Search our published services, parts or vehicle listings.</p>
          <form
            action="/search"
            method="get"
            role="search"
            aria-label="Search the catalogues"
            className={styles.form}
          >
            <div>
              <label htmlFor="public-search-scope">Search in</label>
              <select
                id="public-search-scope"
                name="scope"
                defaultValue={result.scope}
                aria-invalid={result.invalidField === "scope" ? true : undefined}
                aria-describedby={
                  result.invalidField === "scope" ? "public-search-error" : undefined
                }
              >
                {publicSearchScopes.map((scope) => (
                  <option value={scope.value} key={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="public-search-query">Search for</label>
              <input
                id="public-search-query"
                type="search"
                name="search"
                required
                maxLength={100}
                defaultValue={result.query}
                placeholder="For example, diagnostics or brake pads"
                aria-describedby={`public-search-hint${result.invalidField === "search" ? " public-search-error" : ""}`}
                aria-invalid={result.invalidField === "search" ? true : undefined}
              />
            </div>
            <button type="submit" className="button">
              <Search size={18} aria-hidden="true" />
              Search
            </button>
            <p id="public-search-hint" className={styles.hint}>
              Results open in the selected catalogue, where you can refine your search.
            </p>
            {result.error && (
              <p id="public-search-error" className={styles.error} role="alert">
                {result.error}
              </p>
            )}
          </form>
          <p className={styles.help}>
            Not sure what your vehicle needs?{" "}
            <Link href="/contact#enquiry">
              Ask our team <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
