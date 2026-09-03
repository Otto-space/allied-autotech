import { describe, expect, it, vi } from "vitest";

const webAuthnMocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock("@simplewebauthn/server", () => webAuthnMocks);

import { hashToken } from "../../src/common/security/session-tokens.js";
import {
  createWebAuthnAuthenticationOptions,
  createWebAuthnRegistrationOptions,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration,
} from "../../src/common/security/webauthn.js";

describe("WebAuthn policy adapter", () => {
  it("creates registration and authentication options with required user verification", async () => {
    webAuthnMocks.generateRegistrationOptions.mockResolvedValue({
      challenge: "registration-challenge",
    });
    webAuthnMocks.generateAuthenticationOptions.mockResolvedValue({
      challenge: "authentication-challenge",
    });

    await createWebAuthnRegistrationOptions({
      userId: "01900000-0000-7000-8000-000000000001",
      email: "person@example.test",
      excludedCredentialIds: ["credential-one"],
    });
    await createWebAuthnAuthenticationOptions(["credential-one"]);

    expect(webAuthnMocks.generateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: "localhost",
        userName: "person@example.test",
        attestationType: "none",
        authenticatorSelection: expect.objectContaining({
          userVerification: "required",
        }),
      }),
    );
    expect(webAuthnMocks.generateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: "localhost",
        userVerification: "required",
      }),
    );
  });

  it("binds verification to the purpose-hashed challenge, configured origin, and RP ID", async () => {
    webAuthnMocks.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    webAuthnMocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: false,
      authenticationInfo: {
        credentialID: "credential-one",
        newCounter: 1,
        userVerified: true,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        origin: "http://localhost:3000",
        rpID: "localhost",
      },
    });
    const challenge = "single-use-challenge";
    await verifyWebAuthnRegistration({
      response: {},
      expectedChallengeHash: hashToken("webauthn-challenge", challenge),
    });
    await verifyWebAuthnAuthentication({
      response: {},
      expectedChallengeHash: hashToken("webauthn-challenge", challenge),
      credential: {
        id: "credential-one",
        publicKey: Uint8Array.from([1, 2, 3]),
        counter: 0,
      },
    });

    const registrationCall = webAuthnMocks.verifyRegistrationResponse.mock.calls[0]?.[0];
    const authenticationCall =
      webAuthnMocks.verifyAuthenticationResponse.mock.calls[0]?.[0];
    expect(await registrationCall.expectedChallenge(challenge)).toBe(true);
    expect(await registrationCall.expectedChallenge("replayed-or-wrong")).toBe(false);
    expect(registrationCall).toMatchObject({
      expectedOrigin: ["http://localhost:3000"],
      expectedRPID: "localhost",
      requireUserVerification: true,
    });
    expect(authenticationCall).toMatchObject({
      expectedOrigin: ["http://localhost:3000"],
      expectedRPID: "localhost",
      requireUserVerification: true,
    });
  });
});
