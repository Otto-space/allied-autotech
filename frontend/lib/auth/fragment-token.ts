/** Accept a single bounded token from an email link fragment, never a query string. */
export function tokenFromFragment(fragment: string): string {
  if (fragment.length > 4096) return "";
  const params = new URLSearchParams(
    fragment.startsWith("#") ? fragment.slice(1) : fragment,
  );
  const tokens = params.getAll("token");
  return tokens.length === 1 && tokens[0].length >= 32 && tokens[0].length <= 512
    ? tokens[0]
    : "";
}
