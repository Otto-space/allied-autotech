import type { Metadata } from "next";
import { ReviewsPanel } from "../../components/reviews-panel";
import "./reviews.css";
export const metadata: Metadata = { title: "Your reviews" };
export default function Page() {
  return <ReviewsPanel />;
}
