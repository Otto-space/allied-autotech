import type { z } from "zod";
import type { serviceLineSchema } from "@/lib/api/staff-booking-schemas";
import { formatKobo } from "@/lib/format/money";
export function ServiceLineTable({
  items,
  label,
}: {
  items: z.infer<typeof serviceLineSchema>[];
  label: string;
}) {
  if (items.length === 0) return <p>No line items recorded.</p>;
  return (
    <div className="table-region" role="region" aria-label={label} tabIndex={0}>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Type</th>
            <th>Quantity</th>
            <th>Unit price</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>{item.type}</td>
              <td>{item.quantity}</td>
              <td>{formatKobo(item.unitPriceKobo)}</td>
              <td>{formatKobo(item.subtotalKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
