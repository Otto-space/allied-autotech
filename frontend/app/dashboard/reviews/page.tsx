import type { Metadata } from "next";
import { ReviewsPanel } from "../../components/reviews-panel";
export const metadata: Metadata = { title: "Your reviews" };
export default function Page() {
  return <ReviewsPanel />;
}
