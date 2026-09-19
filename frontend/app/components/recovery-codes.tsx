"use client";
import { useEffect, useRef } from "react";
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
      </div>
      <button className="button secondary" onClick={onDismiss}>
        I saved these codes — hide them
      </button>
    </section>
  );
}
