import { browseEnquiriesOnly } from "@/lib/public-launch";
import { indexingEnabled } from "@/lib/seo";
import type { Metadata } from "next";
import { connection } from "next/server";
import localFont from "next/font/local";

import "./globals.css";
import "./overview.css";
import "./public-site.css";
import "./feedback.css";
import "./dashboard-forms.css";
import "./brand-system.css";
import "./status-progress.css";
import "./dashboard-spacing.css";
import "./learning.css";
import { LearningCompanion } from "./components/learning/learning-companion";

import { SupportWidget } from "./components/support-widget";
import { ToastRegion } from "./components/toast-region";
import { FormDrafts } from "./components/form-drafts";
import { ViewportNavigation } from "./components/viewport-navigation";

const quicksand = localFont({
  src: "../public/fonts/quicksand-variable.ttf",
  variable: "--font-quicksand",
  weight: "300 700",
  display: "swap",
});
const nippo = localFont({
  src: "./fonts/Nippo-Variable.woff2",
  variable: "--font-nippo",
  weight: "200 700",
  display: "swap",
});

export function generateMetadata(): Metadata {
  return {
    title: {
      default: "Allied AutoTech",
      template: "%s · Allied AutoTech",
    },
    robots: { index: indexingEnabled(), follow: indexingEnabled() },
    description: browseEnquiriesOnly()
      ? "Explore vehicle care, automotive parts and vehicles, and contact the Allied AutoTech team."
      : "Book trusted vehicle care, track service, and manage your Allied AutoTech account.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();

  return (
    <html lang="en" className={`${quicksand.variable} ${nippo.variable}`}>
      <head>
        {/* Keep one versioned icon mounted across route metadata updates. */}
        <link
          rel="icon"
          href="/brand/allied-favicon-v1.png"
          type="image/png"
          sizes="512x512"
        />
      </head>
      <body>
        {children}
        <SupportWidget />
        <LearningCompanion />
        <ToastRegion />
        <FormDrafts />
        <ViewportNavigation />
      </body>
    </html>
  );
}
