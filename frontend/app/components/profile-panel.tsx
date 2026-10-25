"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, ApiError } from "@/lib/api/client";
import { useResource } from "@/lib/api/use-resource";
import { draftIdentity, draftKey, forgetDraft, DRAFT_SAVED } from "@/lib/forms/drafts";
import {
  readProfileDraft,
  saveProfileDraft,
  rebaseProfileDraft,
} from "@/lib/forms/profile-draft";
import {
  parseProfile,
  profileSchema,
  profileFormSchema,
  profileFormValues,
  profileChanges,
} from "@/lib/api/profile-schemas";
import { ProfilePhoto } from "./profile-photo";
import { Feedback } from "./feedback";
import { useAccountSession } from "./dashboard-shell";

type Profile = z.infer<typeof profileSchema>;
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
  disabled,
  onBusyChange,
}: {
  profile: Profile;
  refresh: () => void;
  disabled: boolean;
  onBusyChange: (value: boolean) => void;
}) {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [initial] = useState(() => readProfileDraft(profile));
  const [baseline, setBaseline] = useState(initial.context);
  const baselineRef = useRef(baseline);
  const [uncertain, setUncertain] = useState(initial.context.recovery);
  const recoveryRef = useRef(initial.context.recovery);
  const resetting = useRef(false);
  const [review, setReview] = useState<Profile>();
  const staleDraft = baseline.version !== profile.profileVersion;
  const [reloading, setReloading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const retryAt = useRef(0);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const waiting = waitSeconds > 0;
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(
      () => setWaitSeconds(Math.max(0, Math.ceil((retryAt.current - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [waiting]);
  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: initial.context.baseline,
    values: initial.values,
    resetOptions: { keepDefaultValues: true },
  });
  useEffect(() => {
    const subscription = form.watch(() => {
      if (!resetting.current)
        saveProfileDraft(
          profile,
          { ...baselineRef.current, recovery: recoveryRef.current },
          form.getValues(),
        );
    });
    return () => subscription.unsubscribe();
  }, [form, profile]);
  const locked =
    disabled ||
    uncertain ||
    staleDraft ||
    !!review ||
    reloading ||
    form.formState.isSubmitting ||
    waiting;
  function resetToSaved(saved: Profile) {
    const next = {
      version: saved.profileVersion,
      baseline: profileFormValues(saved),
      recovery: false,
    };
    baselineRef.current = next;
    recoveryRef.current = false;
    setBaseline(next);
    setUncertain(false);
    setReview(undefined);
    resetting.current = true;
    form.reset(profileFormValues(saved), {
      keepDirtyValues: false,
      keepDefaultValues: false,
    });
    resetting.current = false;
    const owner = draftIdentity();
    if (owner) {
      const key = draftKey(
        owner,
        window.location.pathname,
        JSON.stringify(["profile-panel:1", profile.user.id]),
      );
      forgetDraft(key);
      window.dispatchEvent(new CustomEvent(DRAFT_SAVED, { detail: key }));
    }
  }
  async function reloadSaved() {
    if (pending.current || disabled) return;
    const controller = new AbortController();
    pending.current = controller;
    setReloading(true);
    onBusyChange(true);
    try {
      const response = await apiRequest("/customers/profile", {
        signal: controller.signal,
      });
      const saved = parseProfile(response.data);
      if (saved.user.id !== profile.user.id) throw new Error("Account changed");
      setReview(saved);
      setError(undefined);
      setMessage(undefined);
    } catch (value) {
      if (!controller.signal.aborted)
        setError(
          value instanceof ApiError
            ? value.message
            : "We could not reload your saved details. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) {
        setReloading(false);
        onBusyChange(false);
      }
      if (pending.current === controller) pending.current = null;
    }
  }
  async function save(values: z.infer<typeof profileFormSchema>) {
    // handleSubmit sets isSubmitting before this callback; use the request ref here.
    if (
      pending.current ||
      disabled ||
      uncertain ||
      staleDraft ||
      review ||
      Date.now() < retryAt.current
    )
      return;
    const body = profileChanges({ ...profile, ...baseline.baseline }, values);
    if (!Object.keys(body).length) {
      resetToSaved(profile);
      setMessage("Your profile is already up to date.");
      return;
    }
    const controller = new AbortController();
    pending.current = controller;
    onBusyChange(true);
    setError(undefined);
    setMessage(undefined);
    recoveryRef.current = true;
    saveProfileDraft(profile, { ...baselineRef.current, recovery: true }, values);
    try {
      const response = await apiRequest("/customers/profile", {
        method: "PATCH",
        csrf: true,
        body: { ...body, expectedVersion: baseline.version },
        signal: controller.signal,
      });
      const saved = parseProfile(response.data);
      if (saved.user.id !== profile.user.id) throw new Error("Account changed");
      resetToSaved(saved);
      setMessage("Your profile has been updated.");
      refresh();
    } catch (value) {
      if (controller.signal.aborted) return;
      const rejected =
        value instanceof ApiError && value.status >= 400 && value.status < 500;
      const mustReview =
        !rejected || (value instanceof ApiError && value.code === "STALE_VERSION");
      recoveryRef.current = mustReview;
      setUncertain(mustReview);
      saveProfileDraft(profile, { ...baselineRef.current, recovery: mustReview }, values);
      setError(
        rejected
          ? value.message
          : "We could not confirm your update. Reload your saved details before making another change.",
      );
      if (value instanceof ApiError) {
        if (value.status === 429) {
          const seconds = value.retryAfterSeconds ?? 0;
          retryAt.current = Date.now() + seconds * 1000;
          setWaitSeconds(seconds);
        }
        const invalid = fields.filter((field) => value.fields?.[`body.${field.name}`]);
        for (const field of invalid)
          form.setError(field.name, {
            message: "Check this field and enter a valid value.",
          });
        if (invalid[0]) {
          const name = invalid[0].name;
          requestAnimationFrame(() => {
            if (!controller.signal.aborted) form.setFocus(name);
          });
        }
      }
    } finally {
      if (!controller.signal.aborted) onBusyChange(false);
      if (pending.current === controller) pending.current = null;
    }
  }
  return (
    <div className="cp-editor">
      <Feedback message={error} toast="Please review the message on this page." />
      <Feedback message={message} tone="success" toast={message} />
      {(uncertain || staleDraft) && !review && (
        <p role="status">
          Your draft is preserved. Review the latest saved details before continuing.
        </p>
      )}
      {(uncertain || staleDraft) && !review && (
        <button
          className="button secondary cp-reload"
          disabled={disabled || reloading}
          onClick={() => void reloadSaved()}
        >
          {reloading ? "Reloading saved details…" : "Reload saved details"}
        </button>
      )}
      {review && (
        <section className="cp-review" aria-labelledby="profile-review-title">
          <h2 id="profile-review-title">Review the latest saved details</h2>
          <p>
            Compare these saved details with your draft below. Keeping your changes does
            not save them yet.
          </p>
          <dl>
            {fields.map((field) => (
              <div key={field.name}>
                <dt>{field.label}</dt>
                <dd>{profileFormValues(review)[field.name] || "Not provided"}</dd>
              </div>
            ))}
          </dl>
          <div className="actions">
            <button
              className="button"
              disabled={disabled || reloading}
              onClick={() => {
                const values = rebaseProfileDraft(
                  baselineRef.current,
                  form.getValues(),
                  review,
                );
                resetToSaved(review);
                resetting.current = true;
                form.reset(values, { keepDefaultValues: true });
                resetting.current = false;
                saveProfileDraft(profile, baselineRef.current, values);
                setMessage(
                  "Your draft is ready. Review it, then save when you are ready.",
                );
                refresh();
              }}
            >
              Keep my changes
            </button>
            <button
              className="button secondary"
              disabled={disabled || reloading}
              onClick={() => {
                resetToSaved(review);
                setMessage(
                  "Your saved details have been reloaded. Review them before making another change.",
                );
                refresh();
              }}
            >
              Use saved details
            </button>
          </div>
        </section>
      )}
      <form
        data-no-draft
        data-draft-key={JSON.stringify(["profile-panel:1", profile.user.id])}
        className="cp-form"
        onSubmit={form.handleSubmit(save)}
        noValidate
        aria-label="Profile details"
      >
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
          <fieldset className="form-section" key={group.title} disabled={locked}>
            <legend>{group.title}</legend>
            <p>{group.description}</p>
            {index === 0 && (
              <dl className="cp-email">
                <dt>Account email</dt>
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
              <p className="field-hint cp-country">Country: {profile.country}.</p>
            )}
          </fieldset>
        ))}
        <div className="cp-save">
          <p role="status">
            {waiting
              ? `Try again in ${waitSeconds} seconds.`
              : uncertain || staleDraft || review
                ? "Reload your saved details to continue."
                : form.formState.isDirty
                  ? "You have unsaved changes."
                  : "Your saved details are shown above."}
          </p>
          <div className="actions">
            <button className="button" disabled={locked || !form.formState.isDirty}>
              {form.formState.isSubmitting ? "Saving profile…" : "Save profile"}
            </button>
            <button
              className="button secondary"
              type="button"
              disabled={locked || !form.formState.isDirty}
              onClick={() => {
                resetToSaved(profile);
                setError(undefined);
                setMessage(undefined);
              }}
            >
              Discard changes
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function ProfileIdentity({ profile }: { profile: Profile }) {
  const [failed, setFailed] = useState<string>();
  return (
    <div className="cp-identity">
      {profile.photo && failed !== profile.photo.url ? (
        <Image
          unoptimized
          src={profile.photo.url}
          width={80}
          height={80}
          alt={profile.photo.altText || "Your profile photo"}
          onError={() => setFailed(profile.photo!.url)}
        />
      ) : (
        <span className="cp-initials" aria-hidden="true">
          {`${profile.firstName.slice(0, 1)}${profile.lastName.slice(0, 1)}`.toUpperCase()}
        </span>
      )}
      <div className="cp-name">
        <h2>
          {profile.firstName} {profile.lastName}
        </h2>
        <p>{profile.user.email}</p>
      </div>
      <p className="cp-private">
        Approved public reviews show your profile first and last name and current photo,
        if added.
      </p>
    </div>
  );
}
const compactQuery = "(max-width: 1100px)";
function subscribeCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function PhotoDisclosure({ children }: { children: React.ReactNode }) {
  const compact = useSyncExternalStore(
    subscribeCompact,
    () => window.matchMedia(compactQuery).matches,
    () => false,
  );
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const open = expanded ?? !compact;
  return (
    <details className="cp-photo" open={open}>
      <summary
        onClick={(event) => {
          event.preventDefault();
          setExpanded(!open);
        }}
      >
        <h2 id="profile-photo-title">Profile photo</h2>
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
export function ProfilePanel() {
  const session = useAccountSession();
  const parseOwned = useCallback(
    (value: unknown) => {
      const parsed = parseProfile(value);
      if (parsed.user.id !== session?.user.id) throw new Error("Profile owner mismatch");
      return parsed;
    },
    [session?.user.id],
  );
  const profile = useResource(
    session?.user.role === "CUSTOMER" ? "/customers/profile" : null,
    parseOwned,
  );
  const [formBusy, setFormBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const stale = !!(profile.error || profile.refreshError);
  const unavailable = profile.loading || profile.refreshing || stale;
  return (
    <section className="customer-profile" aria-labelledby="cp-title">
      <div className="cp-heading">
        <div>
          <h1 id="cp-title">Your profile</h1>
          <p>Keep your contact details up to date.</p>
        </div>
        <button
          className="button secondary"
          disabled={profile.loading || profile.refreshing || formBusy || photoBusy}
          onClick={profile.refresh}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh profile
        </button>
      </div>
      <Feedback message={profile.error || profile.refreshError} />
      {stale && profile.data && (
        <p className="cp-stale" role="status">
          Your previous details are shown below. Refresh your profile before making
          changes.
        </p>
      )}
      {(profile.loading || profile.refreshing) && (
        <p className="cp-loading" role="status">
          {profile.data ? "Checking your latest profile…" : "Loading your profile…"}
        </p>
      )}
      {!profile.data && profile.loading && (
        <div className="cp-skeleton" aria-hidden="true">
          <div />
          <div />
        </div>
      )}
      {!profile.data && profile.error && (
        <div className="cp-unavailable">
          <h2>Your profile is unavailable</h2>
          <p>
            Try refreshing. Your contact details and photo will appear once your profile
            can be loaded.
          </p>
          <Link href="/contact" className="button secondary">
            Contact customer care
          </Link>
        </div>
      )}
      {profile.data && (
        <div className="cp-layout">
          <aside className="cp-account" aria-label="Profile identity and photo">
            <ProfileIdentity profile={profile.data} />
            <PhotoDisclosure>
              <ProfilePhoto
                version={profile.data.mediaVersion}
                hasPhoto={!!profile.data.photo}
                refresh={profile.refresh}
                disabled={unavailable || formBusy}
                onReviewChange={setPhotoBusy}
              />
            </PhotoDisclosure>
            <nav className="cp-links" aria-label="Related account settings">
              <Link href="/dashboard/security">
                <ShieldCheck size={18} aria-hidden="true" />
                Security settings
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/dashboard/privacy">
                <FileText size={18} aria-hidden="true" />
                Privacy requests
                <ChevronRight size={16} aria-hidden="true" />
              </Link>
            </nav>
          </aside>
          <ProfileForm
            key={profile.data.user.id}
            profile={profile.data}
            refresh={profile.refresh}
            disabled={unavailable || photoBusy}
            onBusyChange={setFormBusy}
          />
        </div>
      )}
    </section>
  );
}
