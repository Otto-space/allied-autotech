import Link from "next/link";
import styles from "./intake-privacy-note.module.css";

export function IntakePrivacyNote({ account = false }: { account?: boolean }) {
  return (
    <p className="notice">
      {account
        ? "We use your details to provide and secure your account and send essential account messages."
        : "We use your details to respond to and manage your request. Sending a request does not confirm a booking, order or vehicle reservation."}{" "}
      This does not subscribe you to marketing. Read our{" "}
      <Link
        className={styles.link}
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
      >
        privacy notice (opens in a new tab)
      </Link>
      .
    </p>
  );
}
