import { z } from "zod";
const prefix = "aat:learning-progress:v1:";
const progressSchema = z.strictObject({
  id: z.string(),
  version: z.number().int().positive(),
  step: z.number().int().min(0).max(12),
  status: z.enum(["active", "paused", "completed", "dismissed"]),
  lastActivity: z.number().nonnegative(),
});
export type LearningProgress = z.infer<typeof progressSchema>;
export function clearLearningProgress() {
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {
    /* No storage is safer than an operational fallback. */
  }
}
export function loadLearningProgress(
  accessKey: string,
  id: string,
  version: number,
): LearningProgress | "restart" | null {
  try {
    const parsed = progressSchema.safeParse(
      JSON.parse(sessionStorage.getItem(prefix + accessKey + ":" + id) ?? "null"),
    );
    if (!parsed.success || parsed.data.id !== id) return null;
    return parsed.data.version === version ? parsed.data : "restart";
  } catch {
    return null;
  }
}
export function saveLearningProgress(accessKey: string, value: LearningProgress) {
  if (!/^[a-f0-9]{64}$/.test(accessKey)) return false;
  const result = progressSchema.safeParse(value);
  if (!result.success) return false;
  try {
    sessionStorage.setItem(
      prefix + accessKey + ":" + value.id,
      JSON.stringify(result.data),
    );
    return true;
  } catch {
    return false;
  }
}
