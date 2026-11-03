import Link from "next/link";
import { z } from "zod";
import { PurchasePaymentPage } from "../../components/purchase-records";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const ids = z.object({ paymentId: z.uuid(), attemptId: z.uuid() }).safeParse(query);
  if (!ids.success)
    return (
      <>
        <h1>Review your payment status</h1>
        <p>
          The return details are incomplete. Open your purchases to check the recorded
          outcome. Do not pay again while it is uncertain.
        </p>
        <Link className="button" href="/purchase">
          View purchases
        </Link>
      </>
    );
  return (
    <PurchasePaymentPage
      paymentId={ids.data.paymentId}
      returnedAttemptId={ids.data.attemptId}
    />
  );
}
