import type { ReactNode } from "react";
import "./record-references.css";

export function RecordReferences({
  label = "Record references",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="record-references">
      <summary>{label}</summary>
      <div>{children}</div>
    </details>
  );
}
