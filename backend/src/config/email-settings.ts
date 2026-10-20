import { z } from "zod";

// Accept one plain mailbox or display name/mailbox, never header injection.
export const emailSenderSchema = z
  .string()
  .trim()
  .min(1)
  .max(320)
  .refine((value) => {
    if (/[\r\n]/u.test(value)) return false;
    if (z.email().safeParse(value).success) return true;
    const match = /^([^<>]+) <([^<>]+)>$/u.exec(value);
    return (
      match !== null &&
      match[1]!.trim().length > 0 &&
      !/[,;]/u.test(match[1]!) &&
      z.email().safeParse(match[2]).success
    );
  }, "Use one email address, optionally preceded by a display name");
