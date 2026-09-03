import argon2 from "argon2";

const argon2Policy = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

const commonPasswords = new Set([
  "111111111111",
  "123456789012",
  "1234567890ab",
  "1q2w3e4r5t6y",
  "adminadmin12",
  "administrator",
  "alliedautotech",
  "changeme1234",
  "football1234",
  "iloveyou1234",
  "letmeinletmein",
  "monkeymonkey",
  "passw0rd1234",
  "password1234",
  "passwordpassword",
  "qwertyuiop12",
  "qwertyqwerty",
  "sunshinesunshine",
  "welcome12345",
  "welcome123456",
]);

let dummyHashPromise: Promise<string> | undefined;

export function isCommonPassword(password: string): boolean {
  return commonPasswords.has(password.normalize("NFKC").toLowerCase());
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, argon2Policy);
}

export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  dummyHashPromise ??= hashPassword("not-a-real-password-or-account-value");
  const hash = passwordHash ?? (await dummyHashPromise);

  try {
    const matches = await argon2.verify(hash, password);
    return passwordHash === undefined ? false : matches;
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(passwordHash: string): boolean {
  return argon2.needsRehash(passwordHash, argon2Policy);
}
