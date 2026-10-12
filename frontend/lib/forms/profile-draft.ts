import { z } from "zod";
import { profileFormValues, type profileSchema } from "@/lib/api/profile-schemas";
import { draftIdentity, draftKey, readDraft, writeDraft } from "./drafts";

type Profile = z.infer<typeof profileSchema>;
export type ProfileValues = ReturnType<typeof profileFormValues>;
const valuesSchema = z
  .object({
    firstName: z.string().max(250),
    lastName: z.string().max(250),
    phone: z.string().max(250),
    address: z.string().max(250),
    city: z.string().max(250),
    state: z.string().max(250),
  })
  .strict();
const contextSchema = z
  .object({
    version: z.number().int().nonnegative(),
    baseline: valuesSchema,
    recovery: z.boolean(),
  })
  .strict();
export type ProfileDraftContext = z.infer<typeof contextSchema>;

export function profileDraftKey(profile: Profile) {
  const owner = draftIdentity();
  return owner === `${profile.user.id}:CUSTOMER` && typeof window !== "undefined"
    ? draftKey(
        owner,
        window.location.pathname,
        JSON.stringify(["profile-panel:1", profile.user.id]),
      )
    : null;
}

export function readProfileDraft(profile: Profile) {
  const key = profileDraftKey(profile);
  const fields = key ? readDraft(key) : {};
  const current = profileFormValues(profile);
  let context: ProfileDraftContext | undefined;
  try {
    const parsed = contextSchema.safeParse(
      JSON.parse(String(fields["@profile"] ?? "null")),
    );
    if (parsed.success) context = parsed.data;
  } catch {
    /* Old or damaged drafts require review before saving. */
  }
  const values = { ...current };
  let restored = false;
  for (const name of Object.keys(current) as (keyof ProfileValues)[]) {
    const value = fields[`${name}:0`];
    if (typeof value === "string" && value.length <= 250) {
      values[name] = value;
      restored = true;
    }
  }
  return {
    values,
    context: context ?? {
      version: profile.profileVersion,
      baseline: current,
      recovery: restored,
    },
  };
}

export function saveProfileDraft(
  profile: Profile,
  context: ProfileDraftContext,
  values: ProfileValues,
) {
  const key = profileDraftKey(profile);
  if (!key) return;
  writeDraft(key, {
    "@profile": JSON.stringify(context),
    ...Object.fromEntries(
      Object.entries(values).map(([name, value]) => [`${name}:0`, value]),
    ),
  });
}

// Only values actually edited against the old baseline are carried forward.
// The user must see the latest saved values before choosing this operation.
export function rebaseProfileDraft(
  context: ProfileDraftContext,
  values: ProfileValues,
  saved: Profile,
) {
  const next = profileFormValues(saved);
  for (const name of Object.keys(next) as (keyof ProfileValues)[])
    if (values[name] !== context.baseline[name]) next[name] = values[name];
  return next;
}
