const prefix = "aat:support-create:v1:";

export function redactSupportCreateRecoveries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    // Keep the server-side request outcome uncertain if storage is unavailable.
  }
}
