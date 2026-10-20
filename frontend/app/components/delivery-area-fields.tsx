"use client";
import { useState } from "react";
import { deliverySettingsSchema } from "@/lib/api/fulfillment-schemas";
import { koboToInput } from "@/lib/format/currency-input";
import { Feedback } from "./feedback";
type Zone = ReturnType<typeof deliverySettingsSchema.parse>["zones"][number];
export function DeliveryAreaFields({
  initial,
  invalidField,
}: {
  initial?: ReturnType<typeof deliverySettingsSchema.parse>;
  invalidField?: string;
}) {
  const [rows, setRows] = useState(() =>
      (initial?.zones ?? []).map((zone, index) => ({ key: index, zone })),
    ),
    [nextKey, setNextKey] = useState(rows.length),
    [notice, setNotice] = useState("");
  function captureBase(form: HTMLFormElement | null) {
    form
      ?.querySelector('input[name="policyBaseVersion"]')
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return (
    <fieldset className="delivery-areas-editor">
      <legend>Approved delivery areas and fees</legend>
      <p>
        This publishes the complete area list for new orders once effective. Existing
        orders retain their saved fees and addresses.
      </p>
      {rows.map(({ key, zone }, index) => {
        const name = `delivery.${index}`;
        return (
          <fieldset key={key} className="delivery-area" data-draft-row="delivery">
            <legend>Delivery area {index + 1}</legend>
            <input type="hidden" name="areaKey" value={name} />
            <input
              hidden
              aria-hidden="true"
              tabIndex={-1}
              data-draft-context
              name={`${name}-id`}
              defaultValue={zone.id}
            />
            <div className="delivery-fields">
              {(
                [
                  { field: "label", label: "Area name", max: 160 },
                  { field: "city", label: "City", max: 120 },
                  { field: "state", label: "State", max: 120 },
                  { field: "fee", label: "Delivery fee (NGN, before tax)", max: 16 },
                ] as const
              ).map(({ field, label, max }) => (
                <div className="field" key={field}>
                  <label htmlFor={`${name}-${field}`}>{label}</label>
                  <input
                    id={`${name}-${field}`}
                    name={`${name}-${field}`}
                    required
                    maxLength={max}
                    minLength={field === "fee" ? undefined : 2}
                    inputMode={field === "fee" ? "decimal" : undefined}
                    defaultValue={
                      field === "fee" ? koboToInput(zone.feeKobo) : zone[field]
                    }
                    aria-invalid={invalidField === `${name}-${field}`}
                    aria-describedby="delivery-validation"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="button secondary"
              data-draft-remove="delivery"
              onClick={(event) => {
                captureBase(event.currentTarget.form);
                setRows((old) => old.filter((row) => row.key !== key));
                setNotice(`Delivery area ${index + 1} removed from this draft.`);
                document.getElementById("delivery-add-zone")?.focus();
              }}
            >
              Remove area {index + 1}
            </button>
          </fieldset>
        );
      })}
      <Feedback message={notice} tone="info" />
      <button
        type="button"
        id="delivery-add-zone"
        className="button secondary"
        data-draft-add="delivery"
        disabled={rows.length >= 100}
        onClick={(event) => {
          captureBase(event.currentTarget.form);
          const zone: Zone = {
            id: crypto.randomUUID(),
            label: "",
            city: "",
            state: "",
            feeKobo: "",
          };
          setRows((old) => [...old, { key: nextKey, zone }]);
          setNextKey((v) => v + 1);
          setNotice(
            `Delivery area ${rows.length + 1} added. Its fields follow the previous area.`,
          );
        }}
      >
        Add delivery area
      </button>
      <p className="field-hint delivery-area-limit">
        Up to 100 approved areas. Fees use NGN, with up to two decimal places; zero is
        allowed.
      </p>
    </fieldset>
  );
}
