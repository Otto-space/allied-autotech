"use client";
import { useEffect, useRef } from "react";
import { CopyControl } from "./copy-control";
export function RecoveryCodes({
  codes,
  onDismiss,
  headingLevel = "h2",
}: {
  codes: string[];
  headingLevel?: "h1" | "h2";
  onDismiss: () => void;
}) {
  const Heading = headingLevel;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="detail-section">
      <Heading ref={heading} tabIndex={-1}>
        Save your new recovery codes
      </Heading>
      <p>
        Previous recovery codes no longer work. Each new code can be used once. Store them
        privately; these codes are only available in this view and disappear when you
        leave or your session changes.
      </p>
      <p>
        Use a recovery code to sign in if you lose your phone or delete the authenticator
        entry. Deleting that entry does not turn off MFA on your account.
      </p>
      <div className="field">
        <label htmlFor="new-recovery-codes">New recovery codes</label>
        <textarea
          id="new-recovery-codes"
          rows={10}
          readOnly
          autoComplete="off"
          spellCheck={false}
          value={codes.join("\n")}
        />
        <CopyControl
          value={codes.join("\n")}
          label="Copy recovery codes"
          fieldId="new-recovery-codes"
        />
      </div>
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob(
              [
                "Allied AutoTech recovery codes\nStore privately. Each code works once.\n\n" +
                  codes.join("\n"),
              ],
              { type: "text/plain" },
            ),
          );
          const link = document.createElement("a");
          link.href = url;
          link.download = "allied-autotech-recovery-codes.txt";
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download recovery codes
      </button>
      <button className="button secondary" onClick={onDismiss}>
        I saved these codes — hide them
      </button>
    </section>
  );
}
