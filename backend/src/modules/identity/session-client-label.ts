/** A recognisable hint, never device identity or evidence that a session is trusted. */
export function sessionClientLabel(userAgent: string | null): string {
  if (!userAgent) return "Browser details unavailable";
  const agent = userAgent.slice(0, 1024);
  const browser = /Edg(?:e|A|iOS)?\//.test(agent)
    ? "Microsoft Edge"
    : /(?:OPR|Opera)\//.test(agent)
      ? "Opera"
      : /SamsungBrowser\//.test(agent)
        ? "Samsung Internet"
        : /(?:Firefox|FxiOS)\//.test(agent)
          ? "Firefox"
          : /(?:Chrome|CriOS)\//.test(agent)
            ? "Chrome"
            : /Version\/.+Safari\//.test(agent)
              ? "Safari"
              : null;
  const platform = /iPhone/.test(agent)
    ? "iPhone"
    : /iPad/.test(agent) || (/Macintosh/.test(agent) && /Mobile\//.test(agent))
      ? "iPad"
      : /Android/.test(agent)
        ? "Android"
        : /Windows/.test(agent)
          ? "Windows"
          : /CrOS/.test(agent)
            ? "ChromeOS"
            : /Macintosh|Mac OS X/.test(agent)
              ? "macOS"
              : /Linux/.test(agent)
                ? "Linux"
                : null;
  return browser && platform
    ? `${browser} on ${platform}`
    : (browser ?? (platform ? `Browser on ${platform}` : "Unrecognised browser"));
}
