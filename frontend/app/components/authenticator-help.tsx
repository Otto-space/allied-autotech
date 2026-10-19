import Link from "next/link";
import "./authenticator-help.css";

export function AuthenticatorHelp() {
  return (
    <details className="authenticator-help">
      <summary>Lost access to your authenticator?</summary>
      <p>
        Deleting the Allied AutoTech entry from your authenticator app does not turn off
        MFA on your account. The website cannot detect changes made in your app, so your
        authenticator stays linked until you replace or remove it on the website.
      </p>
      <p>
        To sign in, choose Recovery code and use one of your saved, unused codes, or use
        another security key already linked to your account.
      </p>
      <p>
        Choose Set up authenticator again to verify your account and scan a new QR code.
        The selected old registration is removed only after you confirm a code from the
        new setup. Save the new recovery codes before leaving.
      </p>
      <p>
        If you have no recovery code or other linked method, this screen cannot reset your
        MFA. Contact customer care for guidance. Never share your password, setup key or
        recovery codes.
      </p>
      <Link className="text-link" href="/help/lost-authenticator">
        Read account recovery guidance
      </Link>
    </details>
  );
}
