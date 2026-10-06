import Link from "next/link";
import { ProductState } from "./product-state";
export default function NotFound() {
  return (
    <ProductState title="This product is unavailable">
      <p>
        We couldn’t find that page. The listing may have changed or may no longer be
        available.
      </p>
      <div className="actions">
        <Link className="button" href="/parts">
          Browse products
        </Link>
        <Link className="button secondary" href="/contact">
          Contact our team
        </Link>
      </div>
    </ProductState>
  );
}
