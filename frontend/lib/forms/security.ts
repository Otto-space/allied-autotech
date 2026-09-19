import { z } from "zod";
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(128),
    newPassword: z
      .string()
      .min(12, "Use at least 12 characters.")
      .max(128, "Use no more than 128 characters."),
    confirmation: z.string().min(1, "Confirm your new password.").max(128),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    path: ["confirmation"],
    message: "The new passwords must match.",
  });
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;
export const factorRemovalSchema = z.object({
  password: z.string().min(1, "Enter your current password.").max(128),
});
