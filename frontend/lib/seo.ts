import type { Metadata } from "next";
import { business } from "./business";

export const publicPaths = [
  "/",
  "/services",
  "/parts",
  "/vehicles",
  "/contact",
  "/help",
  "/reviews",
] as const;
export const privatePaths = [
  "/dashboard",
  "/admin",
  "/staff",
  "/payments",
  "/login",
  "/register",
  "/mfa",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
] as const;

// Only operator configuration establishes canonical identity, never a request Host header.
export function siteOrigin(): string | undefined {
  try {
    const url = new URL(process.env.SITE_ORIGIN ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      !url.hostname.includes(".") ||
      url.hostname.endsWith(".localhost") ||
      /^[\d.]+$/.test(url.hostname) ||
      url.hostname.includes(":")
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
export function indexingEnabled() {
  return process.env.SITE_INDEXING === "enabled" && !!siteOrigin();
}
export function privatePage(path: string) {
  return privatePaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
export type SearchParameters = Promise<Record<string, string | string[] | undefined>>;
export function publicMetadata(
  title: string,
  description: string,
  path: string,
  filtered = false,
): Metadata {
  const origin = siteOrigin();
  const url = origin ? new URL(path, origin).href : undefined;
  return {
    title,
    description,
    ...(url ? { alternates: { canonical: url } } : {}),
    robots: { index: indexingEnabled() && !filtered, follow: indexingEnabled() },
    openGraph: {
      type: "website",
      siteName: business.name,
      locale: "en_NG",
      title,
      description,
      ...(url ? { url } : {}),
    },
    twitter: { card: "summary", title, description },
  };
}
export async function publicPageMetadata(
  title: string,
  description: string,
  path: string,
  searchParams: SearchParameters,
) {
  return publicMetadata(
    title,
    description,
    path,
    Object.keys(await searchParams).length > 0,
  );
}
export function businessStructuredData() {
  const origin = siteOrigin();
  return {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: business.name,
    telephone: business.internationalPhone,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: "133 Stadium Road, beside Kilimanjaro",
      addressLocality: "Port Harcourt",
      addressRegion: "Rivers State",
      addressCountry: "NG",
    },
    ...(origin ? { url: `${origin}/` } : {}),
  };
}
export function serializeStructuredData(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
