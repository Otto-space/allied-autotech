export function normalizeEmail(email: string): string {
  return email.trim().normalize("NFKC").toLowerCase();
}
