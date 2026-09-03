import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { env } from "../../config/env.js";
import { hashToken } from "./session-tokens.js";
import { timingSafeStringEqual } from "./timing-safe.js";

export async function createWebAuthnRegistrationOptions(input: {
  userId: string;
  email: string;
  excludedCredentialIds: string[];
}) {
  return generateRegistrationOptions({
    rpName: env.WEBAUTHN_RP_NAME,
    rpID: env.WEBAUTHN_RP_ID,
    userName: input.email,
    userID: Buffer.from(input.userId, "utf8"),
    attestationType: "none",
    timeout: env.WEBAUTHN_CHALLENGE_TTL_SECONDS * 1_000,
    excludeCredentials: input.excludedCredentialIds.map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });
}

export async function verifyWebAuthnRegistration(input: {
  response: unknown;
  expectedChallengeHash: string;
}) {
  return verifyRegistrationResponse({
    response: input.response as RegistrationResponseJSON,
    expectedChallenge: (challenge) =>
      timingSafeStringEqual(
        hashToken("webauthn-challenge", challenge),
        input.expectedChallengeHash,
      ),
    expectedOrigin: env.WEBAUTHN_ORIGINS,
    expectedRPID: env.WEBAUTHN_RP_ID,
    requireUserVerification: true,
  });
}

export async function createWebAuthnAuthenticationOptions(credentialIds: string[]) {
  return generateAuthenticationOptions({
    rpID: env.WEBAUTHN_RP_ID,
    allowCredentials: credentialIds.map((id) => ({ id })),
    userVerification: "required",
    timeout: env.WEBAUTHN_CHALLENGE_TTL_SECONDS * 1_000,
  });
}

export async function verifyWebAuthnAuthentication(input: {
  response: unknown;
  expectedChallengeHash: string;
  credential: { id: string; publicKey: Uint8Array; counter: number };
}) {
  return verifyAuthenticationResponse({
    response: input.response as AuthenticationResponseJSON,
    expectedChallenge: (challenge) =>
      timingSafeStringEqual(
        hashToken("webauthn-challenge", challenge),
        input.expectedChallengeHash,
      ),
    expectedOrigin: env.WEBAUTHN_ORIGINS,
    expectedRPID: env.WEBAUTHN_RP_ID,
    credential: {
      ...input.credential,
      publicKey: Uint8Array.from(input.credential.publicKey),
    },
    requireUserVerification: true,
  });
}
