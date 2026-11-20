import { productTimingLabels } from "@/lib/product-timing";
import "./product-timing.css";

export function ProductTiming({
  product,
  showUnknown = false,
  headingLevel = 3,
}: {
  product: Parameters<typeof productTimingLabels>[0];
  showUnknown?: boolean;
  headingLevel?: 2 | 3;
}) {
  const timing = productTimingLabels(product);
  if (!showUnknown && !timing.sourcing && !timing.preparation) return null;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="product-timing" aria-label="Sourcing and preparation estimates">
      <Heading>Sourcing & preparation</Heading>
      <dl>
        {(timing.sourcing || showUnknown) && (
          <div>
            <dt>If sourcing is needed</dt>
            <dd>{timing.sourcing || "Not recorded"}</dd>
          </div>
        )}
        {(timing.preparation || showUnknown) && (
          <div>
            <dt>Preparation once available</dt>
            <dd>{timing.preparation || "Not recorded"}</dd>
          </div>
        )}
      </dl>
      <p>These are estimates. We’ll confirm when your order is ready to collect.</p>
    </section>
  );
}
