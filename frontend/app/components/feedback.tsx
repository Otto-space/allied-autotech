export function Feedback({
  message,
  tone = "error",
}: {
  message?: string | null;
  tone?: "error" | "success" | "info";
}) {
  if (!message) return null;
  return (
    <div
      className={`notice ${tone === "info" ? "" : tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {message}
    </div>
  );
}
