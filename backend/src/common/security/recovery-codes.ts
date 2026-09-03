import { generateOpaqueToken, hashToken } from "./session-tokens.js";

export function generateRecoveryCodes(count = 10): Array<{
  raw: string;
  hash: string;
}> {
  return Array.from({ length: count }, () => {
    const raw = generateOpaqueToken(10);
    return { raw, hash: hashToken("recovery-code", raw) };
  });
}
