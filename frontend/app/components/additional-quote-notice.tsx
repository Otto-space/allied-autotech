import styles from "./additional-quote-notice.module.css";
export function AdditionalQuoteNotice({
  quote,
}: {
  quote: {
    originalInvoice?: { invoiceNumber: string } | null;
    amendmentReason?: string | null;
  };
}) {
  if (!quote.originalInvoice || !quote.amendmentReason) return null;
  return (
    <div className={`field-hint ${styles.notice}`}>
      <p>
        <strong>Additional work</strong> · Original invoice{" "}
        {quote.originalInvoice.invoiceNumber}
      </p>
      <p>{quote.amendmentReason}</p>
      <p>
        These items add to the original agreement. They do not replace its work or
        payments. Accepting does not make a payment or authorise vehicle collection.
      </p>
    </div>
  );
}
