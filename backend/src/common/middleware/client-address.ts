import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { errorCodes } from "../errors/error-codes.js";

const proofHeaders = [
  "x-allied-client-ip",
  "x-allied-client-time",
  "x-allied-client-proof",
];
export function clientAddress(
  source: "socket" | "digitalocean",
  secret?: string,
): RequestHandler {
  return (request, _response, next) => {
    if (source === "socket" || /^\/api\/v1\/health(?:\/|$)/.test(request.path)) {
      next();
      return;
    }
    let address: string | undefined;
    if (proofHeaders.some((name) => request.headers[name] !== undefined)) {
      const ip = request.get(proofHeaders[0]!);
      const time = request.get(proofHeaders[1]!);
      const proof = request.get(proofHeaders[2]!);
      const age = Date.now() / 1000 - Number(time);
      if (
        secret &&
        ip &&
        isIP(ip) &&
        time &&
        /^\d{10}$/.test(time) &&
        age >= -5 &&
        age <= 60 &&
        proof &&
        /^[a-f0-9]{64}$/.test(proof)
      ) {
        const expected = createHmac("sha256", Buffer.from(secret, "base64"))
          .update(`allied-client-v1\n${request.method}\n${request.path}\n${ip}\n${time}`)
          .digest();
        if (timingSafeEqual(expected, Buffer.from(proof, "hex"))) address = ip;
      }
      if (!address) {
        next(
          new AppError({
            code: errorCodes.forbidden,
            statusCode: 403,
            message: "Client request verification failed.",
          }),
        );
        return;
      }
    } else {
      // Enable only on App Platform; prove it overwrites caller-supplied headers
      // on default/custom hostnames before public cutover. XFF is not client IP there.
      const ip = request.get("do-connecting-ip");
      if (ip && isIP(ip)) address = ip;
    }
    if (!address) {
      next(
        new AppError({
          code: errorCodes.providerUnavailable,
          statusCode: 503,
          message: "Request routing is temporarily unavailable.",
        }),
      );
      return;
    }
    Object.defineProperty(request, "ip", { value: address, configurable: false });
    // Express proxy trust remains disabled. These unverified alternatives must
    // not be used by downstream auth/rate-limit logic or trigger XFF validation.
    delete request.headers["x-forwarded-for"];
    delete request.headers["x-real-ip"];
    delete request.headers["forwarded"];
    for (const name of proofHeaders) delete request.headers[name];
    next();
  };
}
