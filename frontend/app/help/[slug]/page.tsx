import Link from "next/link";
import { notFound } from "next/navigation";
import { faqs } from "@/lib/business";
import { publicMetadata } from "@/lib/seo";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = faqs.find((faq) => faq.id === slug);
  if (!article) return { title: "Help article unavailable", robots: { index: false } };
  return publicMetadata(article.question, article.answer.slice(0, 160), `/help/${slug}`);
}
export default async function HelpArticle({ params }: Props) {
  const { slug } = await params;
  const article = faqs.find((faq) => faq.id === slug);
  if (!article) notFound();
  const related = faqs.filter(
    (faq) => faq.id !== slug && faq.category === article.category,
  );
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-page">
        <div className="public-wrap help-article">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/help">Help centre</Link>
            <span aria-hidden="true">/</span>
            <span>{article.category}</span>
          </nav>
          <p className="eyebrow">{article.category}</p>
          <h1>{article.question}</h1>
          <p className="lead">{article.answer}</p>
          <Link className="button" href={article.href}>
            {article.action}
          </Link>
          <section className="help-next">
            <h2>Related help</h2>
            <ul>
              {(related.length
                ? related
                : faqs.filter((faq) => faq.id !== slug).slice(0, 3)
              ).map((faq) => (
                <li key={faq.id}>
                  <Link href={`/help/${faq.id}`}>{faq.question}</Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="help-next">
            <h2>Still need a hand?</h2>
            <p>Our customer-care team can help you find the next step.</p>
            <Link className="text-link" href="/contact#enquiry">
              Contact Allied AutoTech →
            </Link>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
