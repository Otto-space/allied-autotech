export const BLOCKED_API_HOSTS = [
  "api.alliedautotech.com",
  "alliedautotech.com",
  "www.alliedautotech.com",
] as const;

export function validateApiBaseUrl(value: string | undefined): string {
  if (!value?.trim())
    throw new Error(
      "Set EXPO_PUBLIC_API_BASE_URL to a local or isolated staging API ending in /api/v1.",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The API address must be a complete URL ending in /api/v1.");
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    BLOCKED_API_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))
  ) {
    throw new Error(
      "Production API access is blocked in this scaffold in every environment.",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/v1"
  ) {
    throw new Error(
      "Use an HTTP(S) API URL ending exactly in /api/v1, without credentials, query or fragment.",
    );
  }
  return url.toString().replace(/\/$/, "");
}
