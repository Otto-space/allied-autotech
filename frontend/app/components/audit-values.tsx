"use client";
import { useState } from "react";
import type { AuditEvent } from "@/lib/api/audit-schemas";
export function AuditValues({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="audit-values"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Recorded values</summary>
      {open && (
        <>
          <p>
            These values may contain selected fields only. They are not necessarily a
            complete record.
          </p>
          <div className="audit-values-grid">
            {(
              [
                ["Before", event.oldValues],
                ["After", event.newValues],
              ] as const
            ).map(([label, value]) => (
              <section key={label}>
                <h3 id={`audit-${event.id}-${label}`}>{label}</h3>
                <pre
                  className="audit-json"
                  tabIndex={0}
                  role="region"
                  aria-labelledby={`audit-${event.id}-${label}`}
                >
                  {JSON.stringify(value, null, 2)}
                </pre>
              </section>
            ))}
          </div>
        </>
      )}
    </details>
  );
}
