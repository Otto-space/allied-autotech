import { publicMediaHosts } from "./media";

// Only these non-secret hostnames are sent to the browser. Never storage credentials.
export const assetStorageHosts = publicMediaHosts;
export function trustedAssetUrl(
  value: string,
  hosts: readonly string[],
  applicationOrigin?: string,
): string {
  const url = new URL(value);
  if (
    value.length > 8192 ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !hosts.includes(url.hostname) ||
    url.origin === applicationOrigin
  )
    throw new Error("The document storage destination is not approved.");
  return url.href;
}
