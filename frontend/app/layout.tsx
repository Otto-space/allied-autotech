import { indexingEnabled } from "@/lib/seo";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Quicksand } from "next/font/google";

import "./globals.css";
import "./overview.css";

import { SupportWidget } from "./components/support-widget";

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  display: "swap",
});

export function generateMetadata(): Metadata {
  return {
    title: {
      default: "Allied AutoTech",
      template: "%s · Allied AutoTech",
    },
    robots: { index: indexingEnabled(), follow: indexingEnabled() },
    description:
      "Book trusted vehicle care, track service, and manage your Allied AutoTech account.",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  await connection();

  return (
    <html lang="en" data-scroll-behavior="smooth" className={quicksand.variable}>
      <body>
        {children}
        <SupportWidget />
      </body>
    </html>
  );
}
