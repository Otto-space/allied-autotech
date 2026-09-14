import type { Metadata } from "next";
import { CartPanel } from "../../components/cart-panel";
export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return <CartPanel />;
}
