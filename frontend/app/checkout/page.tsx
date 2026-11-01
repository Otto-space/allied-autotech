import { redirect } from "next/navigation";

export default function Page() {
  redirect("/dashboard/cart#cart-checkout-form");
}
