"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/api/client";
import type { RequestBody } from "@/lib/api/contracts";
import { parseInvoice } from "@/lib/api/invoice-schemas";
import { formatBusinessDate } from "@/lib/format/date";
import { InvoiceSourcePicker } from "./invoice-source-picker";
import { MutationReview, type MutationProposal } from "./mutation-review";
import { Feedback } from "./feedback";
const dueTimestamp = (value: string) => `${value}:00+01:00`;
const schema = z.object({
  sourceType: z.enum(["ORDER", "BOOKING", "VEHICLE_TRANSACTION"]),
  sourceId: z.string().uuid("Choose an invoice source."),
  dueAt: z
    .string()
    .refine(
      (value) =>
        !value ||
        (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
          new Date(dueTimestamp(value)).getTime() > Date.now()),
      "Choose a future due date in Lagos time.",
    ),
});
type Values = z.infer<typeof schema>;
export function InvoiceCreateForm({ onSaved }: { onSaved: () => void }) {
  const router = useRouter();
  const [proposal, setProposal] = useState<MutationProposal | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    shouldFocusError: false,
    defaultValues: { sourceType: "ORDER", sourceId: "", dueAt: "" },
  });
  const kind = useWatch({ control: form.control, name: "sourceType" });
  const errors = form.formState.errors;
  function review(values: Values) {
    if (proposal || uncertain) return;
    const body: RequestBody<"/staff/invoices", "post"> = {
      sourceType: values.sourceType,
      sourceId: values.sourceId,
      ...(values.dueAt ? { dueAt: dueTimestamp(values.dueAt) } : {}),
    };
    setProposal({
      title: "Create this draft invoice?",
      description:
        "The server calculates the amount from the source record, including any eligible booking deposit credit. The draft must be reviewed and issued separately. This does not record or collect a payment.",
      facts: [
        { label: "Source", value: sourceLabel },
        {
          label: "Due date",
          value: body.dueAt ? formatBusinessDate(body.dueAt) : "Not set",
        },
      ],
      onUncertain: () => setUncertain(true),
      submit: async () => {
        const result = await apiRequest("/staff/invoices", {
          method: "POST",
          body,
          csrf: true,
        });
        const invoice = parseInvoice(result.data);
        onSaved();
        router.push(`/admin/invoices/${invoice.id}`);
      },
    });
  }
  return (
    <section className="detail-section">
      <h2>Create an invoice</h2>
      <p>
        Orders use their recorded total. Bookings require an accepted quotation. Vehicle
        transactions require an agreed price and an eligible purchase status.
      </p>
      <Feedback
        message={
          uncertain
            ? "The creation outcome is uncertain. Refresh the invoice list and check the source record before continuing. This form cannot be resubmitted."
            : undefined
        }
      />
      <form
        noValidate
        onSubmit={form.handleSubmit(review, (validation) => {
          const first = (["sourceType", "sourceId", "dueAt"] as const).find(
            (name) => validation[name],
          );
          if (first) form.setFocus(first);
        })}
      >
        <fieldset disabled={!!proposal || uncertain}>
          <div className="field">
            <label htmlFor="invoice-source-type">Invoice source type</label>
            <select
              id="invoice-source-type"
              {...form.register("sourceType")}
              onChange={(event) => {
                const result = schema.shape.sourceType.safeParse(event.target.value);
                if (!result.success) return;
                form.setValue("sourceType", result.data);
                form.setValue("sourceId", "");
                setSourceLabel("");
              }}
            >
              <option value="ORDER">Order</option>
              <option value="BOOKING">Booking</option>
              <option value="VEHICLE_TRANSACTION">Vehicle transaction</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="invoice-source">Source record</label>
            <Controller
              control={form.control}
              name="sourceId"
              render={({ field }) => (
                <InvoiceSourcePicker
                  key={kind}
                  kind={kind}
                  value={field.value}
                  inputRef={field.ref}
                  error={errors.sourceId?.message}
                  onChange={(id, label) => {
                    field.onChange(id);
                    setSourceLabel(label);
                  }}
                />
              )}
            />
          </div>
          <div className="field">
            <label htmlFor="invoice-due">Due date (optional, Lagos time)</label>
            <input
              id="invoice-due"
              type="datetime-local"
              {...form.register("dueAt")}
              aria-invalid={!!errors.dueAt}
              aria-describedby={errors.dueAt ? "invoice-due-error" : undefined}
            />
            {errors.dueAt && (
              <p id="invoice-due-error" className="field-error" role="alert">
                {errors.dueAt.message}
              </p>
            )}
          </div>
          <button className="button">Review draft invoice</button>
        </fieldset>
      </form>
      {proposal && (
        <MutationReview
          proposal={proposal}
          onClose={() => {
            setProposal(null);
            onSaved();
          }}
          onSuccess={() => setUncertain(false)}
        />
      )}
    </section>
  );
}
