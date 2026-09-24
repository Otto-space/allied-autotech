import type { z } from "zod";
import type { operationalOrderSchema } from "@/lib/api/commerce-schemas";
export function OrderDeliveryDetails({
  order,
}: {
  order: z.infer<typeof operationalOrderSchema>;
}) {
  if (order.fulfillmentMethod !== "DELIVERY") return null;
  return (
    <section className="detail-section" aria-label="Delivery details">
      <h3>Delivery details</h3>
      {order.deliveryAddress ? (
        <>
          {order.deliveryName && <p>Recipient: {order.deliveryName}</p>}
          {order.deliveryPhone && <p>Phone: {order.deliveryPhone}</p>}
          <p>{order.deliveryAddress}</p>
          <p>
            {[order.deliveryCity, order.deliveryState, order.deliveryCountry]
              .filter(Boolean)
              .join(", ")}
          </p>
        </>
      ) : (
        <p>
          Delivery details are unavailable for this record. Contact customer care before
          proceeding.
        </p>
      )}
    </section>
  );
}
