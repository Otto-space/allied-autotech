"use client";
import { vehicleLabel } from "@/lib/vehicle-discovery";

const used = ["USED", "FOREIGN_USED", "LOCALLY_USED"];
export function VehicleConditionField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selected = value.split(",").filter(Boolean);
  const mixed = selected.includes("NEW") && selected.some((item) => used.includes(item));
  const mode = !selected.length
    ? "any"
    : selected.every((item) => item === "NEW")
      ? "new"
      : mixed
        ? "mixed"
        : "used";
  return (
    <fieldset className="vehicle-multiple-options">
      <legend>Vehicle condition</legend>
      {[
        ["any", "Any condition"],
        ["new", "Brand new"],
        ["used", "Used"],
      ].map(([key, label]) => (
        <label key={key}>
          <input
            type="radio"
            name="vehicle-condition-group"
            value={key}
            checked={mode === key}
            onChange={() =>
              onChange(key === "any" ? "" : key === "new" ? "NEW" : used.join(","))
            }
          />
          <span>{label}</span>
        </label>
      ))}
      {mixed && (
        <p>
          Brand new and used selected in this link. Choose a condition above to replace
          this combination.
        </p>
      )}
      {(mode === "used" || mixed) && (
        <fieldset className="vehicle-use-history">
          <legend>Recorded use history</legend>
          {used.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => {
                  const next = new Set(selected);
                  if (event.target.checked) next.add(option);
                  else next.delete(option);
                  onChange([...next].join(","));
                }}
              />
              <span>{vehicleLabel(option)}</span>
            </label>
          ))}
          <small>
            Used includes all three histories. Unspecified origin does not mean foreign or
            Nigerian use.
          </small>
        </fieldset>
      )}
    </fieldset>
  );
}
