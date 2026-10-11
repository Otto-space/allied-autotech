import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { SiteHeader } from "../../components/site-header";
import { SiteFooter } from "../../components/site-footer";
import "./article.css";
export default function ArticleNotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="public-site help-detail">
        <nav className="ha-breadcrumb" aria-label="Breadcrumb">
          <ol className="ha-wrap">
            <li>
              <Link href="/">Home</Link>
              <ChevronRight size={14} aria-hidden="true" />
            </li>
            <li>
              <Link href="/help">Help centre</Link>
              <ChevronRight size={14} aria-hidden="true" />
            </li>
            <li className="ha-breadcrumb-current" aria-current="page">
              <span>Unavailable article</span>
            </li>
          </ol>
        </nav>
        <div className="ha-wrap ha-unavailable">
          <h1>Help article unavailable.</h1>
          <p>
            This article could not be found. Browse the Help Centre to find another
            answer.
          </p>
          <Link className="button" href="/help">
            Browse help topics
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
