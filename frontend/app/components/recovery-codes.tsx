"use client";
import { useEffect, useRef } from "react";
import { CopyControl } from "./copy-control";
export function RecoveryCodes({
  codes,
  onDismiss,
}: {
  codes: string[];
  onDismiss: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="detail-section">
      <h2 ref={heading} tabIndex={-1}>
        Save your new recovery codes
      </h2>
      <p>
        Previous recovery codes no longer work. Each new code can be used once. Store them
        privately; these codes are only available in this view and disappear when you
        leave or your session changes.
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
