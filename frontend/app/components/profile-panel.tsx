"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import {
  parseProfile,
  profileSchema,
  profileFormSchema,
} from "@/lib/api/profile-schemas";
import type { RequestBody } from "@/lib/api/contracts";
import { Feedback } from "./feedback";

const fields = [
  {
    name: "firstName",
    label: "First name",
    autoComplete: "given-name",
    max: 80,
    required: true,
  },
  {
    name: "lastName",
    label: "Last name",
    autoComplete: "family-name",
    max: 80,
    required: true,
  },
  { name: "phone", label: "Phone number", autoComplete: "tel", max: 32, required: true },
  {
    name: "address",
    label: "Street address (optional)",
    autoComplete: "street-address",
    max: 250,
    required: false,
  },
  {
    name: "city",
    label: "City (optional)",
    autoComplete: "address-level2",
    max: 100,
    required: false,
  },
  {
    name: "state",
    label: "State (optional)",
    autoComplete: "address-level1",
    max: 100,
    required: false,
  },
] as const;
function ProfileForm({
  profile,
  refresh,
}: {
  profile: z.infer<typeof profileSchema>;
  refresh: () => void;
}) {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const submitting = useRef(false);
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    values: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      address: profile.address ?? "",
      city: profile.city ?? "",
      state: profile.state ?? "",
    },
    resetOptions: { keepDirtyValues: true },
  });
  async function save(values: z.infer<typeof profileFormSchema>) {
    if (submitting.current) return;
    submitting.current = true;
    setError(undefined);
    setMessage(undefined);
    const body: RequestBody<"/customers/profile", "patch"> = {
      ...values,
      address: values.address || null,
      city: values.city || null,
      state: values.state || null,
      country: "Nigeria",
    };
    try {
      const response = await apiRequest("/customers/profile", {
        method: "PATCH",
        csrf: true,
        body,
      });
      parseProfile(response.data);
      form.reset(values);
      setMessage("Your profile has been updated.");
      refresh();
    } catch (value) {
      setError(
        value instanceof ApiError
          ? value.message
          : "We could not confirm your update. Refresh your profile before making another change.",
      );
      if (value instanceof ApiError) {
        const invalid = fields.filter((field) => value.fields?.[`body.${field.name}`]);
        for (const field of invalid)
          form.setError(field.name, {
            message: "Check this field and enter a valid value.",
          });
        if (invalid[0]) form.setFocus(invalid[0].name);
      }
    } finally {
      submitting.current = false;
    }
  }
  return (
    <>
      <Feedback message={error} toast="Please review the message on this page." />
      <Feedback message={message} tone="success" toast="Your profile has been updated." />
      <form className="card" onSubmit={form.handleSubmit(save)} noValidate>
        {[
          {
            title: "Personal details",
            description:
              "We use these details to contact you about your bookings and purchases.",
            entries: fields.slice(0, 3),
          },
          {
            title: "Address",
            description: "Optional. Useful for delivery and service requests.",
            entries: fields.slice(3),
          },
        ].map((group, index) => (
          <fieldset className="form-section" key={group.title}>
            <legend>{group.title}</legend>
            <p>{group.description}</p>
            {index === 0 && (
              <dl className="account-email">
                <dt className="field-label">Account email</dt>
                <dd>{profile.user.email}</dd>
              </dl>
            )}
            <div className="form-row">
              {group.entries.map((field) => (
                <div
                  className={`field${field.name === "address" || field.name === "phone" ? " field-wide" : ""}`}
                  key={field.name}
                >
                  <label htmlFor={`profile-${field.name}`}>{field.label}</label>
                  <input
                    id={`profile-${field.name}`}
                    type={field.name === "phone" ? "tel" : "text"}
                    autoComplete={field.autoComplete}
                    required={field.required}
                    maxLength={field.max}
                    aria-invalid={!!form.formState.errors[field.name]}
                    aria-describedby={
                      form.formState.errors[field.name]
                        ? `profile-${field.name}-error`
                        : undefined
                    }
                    {...form.register(field.name)}
                  />
                  {form.formState.errors[field.name] && (
                    <span className="field-error" id={`profile-${field.name}-error`}>
                      {form.formState.errors[field.name]?.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {index === 1 && (
              <p className="field-hint profile-country">Country: Nigeria.</p>
            )}
          </fieldset>
        ))}
        <div className="form-actions">
          <button className="button" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving profile…" : "Save profile"}
          </button>
          <p>Your changes are saved when you select Save profile.</p>
        </div>
      </form>
    </>
  );
}
export function ProfilePanel() {
  const profile = useResource("/customers/profile", parseProfile);
  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <h1>Your profile</h1>
          <p className="lead">Keep your contact details up to date.</p>
        </div>
        <button
          className="button secondary"
          disabled={profile.loading}
          onClick={profile.refresh}
        >
          Refresh profile
        </button>
      </div>
      <Feedback message={profile.error} />
      {profile.loading && (
        <p role="status">
          {profile.data ? "Checking your latest profile…" : "Loading your profile…"}
        </p>
      )}
      {profile.data && (
        <ProfileForm
          key={profile.data.user.id}
          profile={profile.data}
          refresh={profile.refresh}
        />
      )}
    </>
  );
}
