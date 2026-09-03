import { timingSafeEqual } from "node:crypto";

export function timingSafeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.byteLength === rightBuffer.byteLength
    ? timingSafeEqual(leftBuffer, rightBuffer)
    : false;
}
