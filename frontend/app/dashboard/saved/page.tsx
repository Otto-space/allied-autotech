import type { Metadata } from "next";
import { SavedItems } from "../../components/saved-items";
export const metadata: Metadata = { title: "Saved items" };
export default function Page() {
  return <SavedItems />;
}
