import { PublicHome } from "./components/public-home";
import { headers } from "next/headers";
import {
  businessStructuredData,
  publicPageMetadata,
  serializeStructuredData,
  type SearchParameters,
} from "@/lib/seo";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParameters;
}) {
  return publicPageMetadata(
    "Allied AutoTech | Automotive Services, Diagnostics & Vehicle Solutions in Port Harcourt",
    "Professional automotive care, diagnostics and maintenance in Port Harcourt. Shop automotive products and explore vehicle solutions from Allied AutoTech.",
    "/",
    searchParams,
  );
}
export default async function HomePage() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData(businessStructuredData()),
        }}
      />
      <PublicHome />
    </>
  );
}
