// Keep aligned with the authoritative catalogue write validation.
export function isDurablePublicImageUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      host.includes(".") &&
      !/^[\d.]+$/.test(host) &&
      !host.startsWith("[") &&
      !/(^|\.)(localhost|local|internal|home|lan)$/.test(host) &&
      ![...url.searchParams.keys()].some((key) =>
        /^(x-amz-.+|x-goog-.+|token|access_token|signature|sig|expires|expiry|exp|se|sp|sv)$/i.test(
          key,
        ),
      )
    );
  } catch {
    return false;
  }
}
