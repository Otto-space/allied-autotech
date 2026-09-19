"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { MutationProposal } from "./mutation-review";
export function OperationActionForm({
  id,
  revision,
  label,
  options,
  maxLength,
  disabled,
  uncertain,
  onReview,
  proposal,
}: {
  id: string;
  revision: string;
  label: string;
  options: readonly string[];
  maxLength: number;
  disabled: boolean;
  uncertain: boolean;
  onReview: (proposal: MutationProposal) => void;
  proposal: (values: { status: string; reason: string }) => MutationProposal;
}) {
  const [draftRevision, setDraftRevision] = useState(revision);
  const form = useForm({
    resolver: zodResolver(
      z.object({
        status: z.string().refine((value) => options.includes(value)),
        reason: z
          .string()
          .trim()
          .min(3, "Enter at least three characters explaining this action.")
          .max(maxLength),
      }),
    ),
    defaultValues: { status: options[0], reason: "" },
  });
  const changed = revision !== draftRevision;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => {
        if (!disabled && !uncertain && !changed) onReview(proposal(values));
      })}
    >
      {uncertain && (
        <p role="status" className="notice">
          This action could not be confirmed. Refresh the records to reconcile the
          outcome. This form will not resend it.
        </p>
      )}
      {changed && !uncertain && (
        <div className="notice">
          <p>
            The record changed while this form was open. Review the new state before
            making a decision.
          </p>
          <button
            type="button"
            className="button secondary"
            disabled={disabled}
            onClick={() => {
              form.reset({ status: options[0], reason: "" });
              setDraftRevision(revision);
            }}
          >
            Reload action fields
          </button>
        </div>
      )}
      <fieldset className="handover-fields" disabled={disabled || uncertain || changed}>
        {options.length > 1 && (
          <div className="field">
            <label htmlFor={`${id}-status`}>New exception status</label>
            <select id={`${id}-status`} {...form.register("status")}>
              {options.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-reason`}>{label} reason</label>
          <textarea
            id={`${id}-reason`}
            {...form.register("reason")}
            maxLength={maxLength}
            rows={3}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={form.formState.errors.reason ? `${id}-error` : undefined}
          />
          {form.formState.errors.reason && (
            <p className="field-error" role="alert" id={`${id}-error`}>
              {form.formState.errors.reason.message}
            </p>
          )}
        </div>
        <button className="button secondary">Review {label.toLowerCase()}</button>
      </fieldset>
    </form>
  );
}
