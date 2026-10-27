import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { catalogueOnly } from "@/lib/public-launch";
import { ArrowRight, ArrowUpRight, ChevronRight, Phone } from "lucide-react";
import { business, faqs } from "@/lib/business";
import { helpArticleGuidance } from "@/lib/help-article-guidance";
import {
  indexingEnabled,
  publicPageMetadata,
  serializeStructuredData,
  siteOrigin,
  type SearchParameters,
} from "@/lib/seo";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import { ArticleAccountAction } from "./article-account-action";
import "./article.css";

type Props = { params: Promise<{ slug: string }>; searchParams: SearchParameters };
export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  const article = faqs.find((faq) => faq.id === slug);
  if (!article)
    return { title: "Help article unavailable", robots: { index: false, follow: false } };
  return publicPageMetadata(
    article.question,
    article.answer.slice(0, 160),
    `/help/${article.id}`,
    searchParams,
  );
}
export default async function HelpArticle({ params, searchParams }: Props) {
  if (catalogueOnly()) redirect("/help");
  const { slug } = await params;
  const article = faqs.find((faq) => faq.id === slug);
  if (!article) notFound();
  const related = faqs.filter(
    (faq) => faq.id !== slug && faq.category === article.category,
  );
  const suggestions = related.length
    ? related
    : faqs.filter((faq) => faq.id !== slug).slice(0, 3);
  const notes = helpArticleGuidance[article.id];
  const origin = siteOrigin();
  const structured =
    indexingEnabled() && origin && !Object.keys(await searchParams).length
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: `${origin}/` },
            {
              "@type": "ListItem",
              position: 2,
              name: "Help centre",
              item: `${origin}/help`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: article.question,
              item: `${origin}/help/${article.id}`,
            },
          ],
        }
      : null;
  const external = article.href.startsWith("https://");
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-detail">
        {structured && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeStructuredData(structured) }}
          />
        )}
        <nav className="ha-breadcrumb" aria-label="Breadcrumb">
          <ol className="ha-wrap">
            <li>
              <Link href="/">Home</Link>
              <ChevronRight size={14} aria-hidden="true" />
            </li>
            <li className="ha-breadcrumb-middle">
              <Link href="/help">Help centre</Link>
              <ChevronRight size={14} aria-hidden="true" />
            </li>
            <li className="ha-breadcrumb-current" aria-current="page">
              <span title={article.question}>{article.question}</span>
            </li>
          </ol>
        </nav>
        <div className="ha-wrap ha-layout">
          <article className="ha-article" aria-labelledby="ha-title">
            <header>
              <h1 id="ha-title">{article.question}</h1>
              <Link
                className="ha-text-link ha-topic"
                href={`/help?topic=${encodeURIComponent(article.category)}`}
              >
                {article.category}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </header>
            <section className="ha-answer" aria-labelledby="ha-answer-title">
              <h2 id="ha-answer-title">Your next step</h2>
              <p>{article.answer}</p>
              <div className="ha-action">
                {article.href.startsWith("/dashboard/") ? (
                  <ArticleAccountAction
                    key={article.id}
                    href={article.href}
                    action={article.action}
                  />
                ) : (
                  <Link
                    className="button"
                    href={article.href}
                    {...(external
                      ? {
                          target: "_blank",
                          rel: "noopener noreferrer",
                          "aria-label": `${article.action} (opens in a new tab)`,
                        }
                      : {})}
                  >
                    {article.action}
                    {external ? (
                      <ArrowUpRight size={16} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={16} aria-hidden="true" />
                    )}
                  </Link>
                )}
              </div>
            </section>
            {notes && (
              <section className="ha-preparation" aria-labelledby="ha-preparation-title">
                <h2 id="ha-preparation-title">Helpful details to have ready</h2>
                <ul>
                  {notes.map((note, index) => (
                    <li key={note}>
                      <span aria-hidden="true">{index + 1}</span>
                      <p>{note}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
          <aside className="ha-related" aria-labelledby="ha-related-title">
            <h2 id="ha-related-title">{related.length ? "Related help" : "More help"}</h2>
            <ul>
              {suggestions.map((faq) => (
                <li key={faq.id}>
                  <Link href={`/help/${faq.id}`}>
                    <span>{faq.question}</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="ha-text-link" href="/help">
              All help topics
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </div>
        <section className="ha-contact" aria-labelledby="ha-contact-title">
          <div className="ha-wrap ha-contact-layout">
            <div>
              <h2 id="ha-contact-title">Still need a hand?</h2>
              <p>Our customer-care team can help you find the next step.</p>
              <Link className="button secondary" href="/contact#enquiry">
                Contact Allied AutoTech
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="ha-contact-links">
              <a href={`tel:${business.internationalPhone}`}>
                <Phone size={20} aria-hidden="true" />
                Call our team
              </a>
              <a
                href={business.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Whatsapp (opens in a new tab)"
              >
                Whatsapp
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
