import { it, expect } from "vitest";
import { registrationFields } from "@/lib/auth/registration";
const data = {
  firstName: "Ada",
  lastName: "Okafor",
  phone: "+2348000000000",
  email: "register@example.test",
  password: "Unique registration phrase!1",
};
it("accepts Unicode names and preserves password spacing", () =>
  expect(
    registrationFields.parse({
      ...data,
      firstName: "  Adé  ",
      lastName: "O'Connor-Smith",
      password: "  Unique passphrase  ",
    }),
  ).toMatchObject({
    firstName: "Adé",
    lastName: "O'Connor-Smith",
    password: "  Unique passphrase  ",
  }));
it.each([
  { firstName: "123" },
  { lastName: "😀" },
  { firstName: "x".repeat(81) },
  { phone: "not-phone" },
  { phone: "123" },
  { phone: "1".repeat(33) },
  { email: "invalid" },
  { password: "short" },
  { password: "x".repeat(129) },
])("rejects invalid registration fields %#", (change) =>
  expect(registrationFields.safeParse({ ...data, ...change }).success).toBe(false),
);
