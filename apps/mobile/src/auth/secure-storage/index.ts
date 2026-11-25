import * as SecureStore from "expo-secure-store";

// Auth secrets belong only in secure storage, never AsyncStorage. No auth secrets
// or tokens are created by this scaffold. Registry survives process restarts.
const registryKey = "aat.companion.keys";
const prefix = "aat.companion.value.";
let pending: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const result = pending.then(work);
  pending = result.catch(() => {});
  return result;
}
async function keys(): Promise<string[]> {
  const raw = await SecureStore.getItemAsync(registryKey);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    !parsed.every(
      (value): value is string => typeof value === "string" && /^[\w.-]+$/.test(value),
    )
  )
    throw new Error("Secure storage registry could not be verified.");
  return parsed;
}
function storageKey(key: string): string {
  if (!/^[\w.-]+$/.test(key)) throw new Error("Invalid secure storage key");
  return prefix + key;
}
export const secureStorage = {
  get: (key: string) => serial(() => SecureStore.getItemAsync(storageKey(key))),
  set: (key: string, value: string) =>
    serial(async () => {
      const target = storageKey(key);
      const list = await keys();
      // Register before writing so interruption cannot orphan a secret.
      await SecureStore.setItemAsync(
        registryKey,
        JSON.stringify([...new Set([...list, key])]),
      );
      await SecureStore.setItemAsync(target, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }),
  remove: (key: string) =>
    serial(async () => {
      await SecureStore.deleteItemAsync(storageKey(key));
      await SecureStore.setItemAsync(
        registryKey,
        JSON.stringify((await keys()).filter((entry) => entry !== key)),
      );
    }),
  clearAll: () =>
    serial(async () => {
      for (const key of await keys()) await SecureStore.deleteItemAsync(storageKey(key));
      await SecureStore.deleteItemAsync(registryKey);
    }),
};
