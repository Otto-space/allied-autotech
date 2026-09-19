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
    "Vehicle care, parts & vehicles in Port Harcourt",
    "Explore Allied AutoTech services, parts and vehicle listings. Find our workshop at 133 Stadium Road, beside Kilimanjaro, Port Harcourt.",
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
