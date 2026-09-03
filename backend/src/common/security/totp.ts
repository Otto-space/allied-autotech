import { generateSecret, generateURI, verify } from "otplib";

export function createTotpEnrollment(email: string): {
  secret: string;
  uri: string;
} {
  const secret = generateSecret({ length: 20 });
  return {
    secret,
    uri: generateURI({ issuer: "Allied AutoTech", label: email, secret }),
  };
}

export async function verifyTotp(
  secret: string,
  code: string,
  lastUsedAt?: Date | null,
): Promise<{ valid: boolean; usedAt?: Date }> {
  const afterTimeStep = lastUsedAt
    ? Math.floor(lastUsedAt.getTime() / 1_000 / 30)
    : undefined;
  const result = await verify({
    secret,
    token: code,
    epochTolerance: [30, 0],
    ...(afterTimeStep === undefined ? {} : { afterTimeStep }),
  });

  return result.valid && "timeStep" in result
    ? { valid: true, usedAt: new Date(result.timeStep * 30 * 1_000) }
    : { valid: false };
}
