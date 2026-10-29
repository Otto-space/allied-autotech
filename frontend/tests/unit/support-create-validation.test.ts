import { expect, it } from "vitest";
import { supportCreationSchema, supportText } from "@/lib/api/support-schemas";

const valid = {
  subject: "Workshop question",
  message: "Please help with my vehicle.",
  name: "Contact Fixture",
  email: "contact@example.test",
  phone: "",
};

it.each([true, false])(
  "identifies empty request fields for public mode %s",
  (publicMode) => {
    const result = supportCreationSchema(publicMode).safeParse({
      ...valid,
      subject: "   ",
      message: "\n\t",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map(({ path, message }) => ({ path, message }))).toEqual(
        [
          { path: ["subject"], message: "Enter a subject for your request." },
          {
            path: ["message"],
            message: "Enter a message with the details of your request.",
          },
        ],
      );
  },
);

it("preserves trimming, size limits and control-character rejection", () => {
  const schema = supportCreationSchema(true);
  expect(
    schema.parse({ ...valid, subject: "  Question  ", message: "  Details\nHere  " }),
  ).toMatchObject({ subject: "Question", message: "Details\nHere" });
  expect(
    schema.safeParse({ ...valid, subject: "x".repeat(160), message: "x".repeat(4000) })
      .success,
  ).toBe(true);
  for (const fields of [
    { subject: "x".repeat(161) },
    { message: "x".repeat(4001) },
    { message: "Hidden\u0001character" },
  ])
    expect(schema.safeParse({ ...valid, ...fields }).success).toBe(false);
});

it("preserves public identity validation and the generic reply validation contract", () => {
  const fields = { ...valid, name: "", email: "" };
  expect(supportCreationSchema(true).safeParse(fields).success).toBe(false);
  expect(supportCreationSchema(false).safeParse(fields).success).toBe(true);
  const reply = supportText(4000).safeParse("");
  expect(reply.success).toBe(false);
  if (!reply.success)
    expect(reply.error.issues[0].message).toBe("Enter the required information.");
});
