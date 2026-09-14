export function publicMediaHosts(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter((host) =>
          /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host),
        ),
    ),
  ];
}

export function isPublicMediaUrl(src: string, hosts: readonly string[]): boolean {
  if (/^\/api\/v1\/public\/vehicles\/images\/[0-9a-f-]{36}$/i.test(src)) return true;
  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      hosts.includes(url.hostname)
    );
  } catch {
    return false;
  }
}
