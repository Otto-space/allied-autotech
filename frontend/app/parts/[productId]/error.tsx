"use client";
import Link from "next/link";
import { ProductState } from "./product-state";
export default function Error({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ProductState title="Product details are temporarily unavailable">
      <p>We couldn’t load this product. Please try again or contact our team for help.</p>
      <div className="actions">
        <button className="button" onClick={retry}>
          Try again
        </button>
        <Link className="button secondary" href="/parts">
          Browse products
        </Link>
        <Link className="button secondary" href="/contact">
          Contact our team
        </Link>
      </div>
    </ProductState>
  );
}
