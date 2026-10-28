"use client";

import { useId, type Ref } from "react";
import { countries, countryName } from "@/lib/reference/countries";

const aliases: Record<string, string[]> = {
  GB: ["UK", "Britain", "United Kingdom"],
  US: ["USA", "United States", "America"],
  KR: ["South Korea", "Korea"],
  KP: ["North Korea"],
  CI: ["Ivory Coast", "Cote d'Ivoire"],
  CZ: ["Czech Republic"],
  TR: ["Turkey"],
  RU: ["Russia"],
  VN: ["Vietnam"],
  LA: ["Laos"],
  BO: ["Bolivia"],
  VE: ["Venezuela"],
  TZ: ["Tanzania"],
  IR: ["Iran"],
  SY: ["Syria"],
  MD: ["Moldova"],
};
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function resolveCountry(text: string) {
  const value = normalize(text);
  return countries.find((country) =>
    [country.name, country.code, ...(aliases[country.code] ?? [])].some(
      (name) => normalize(name) === value,
    ),
  )?.code;
}

/** Native searchable combobox: keyboard, touch and free-text validation all work.
 * Unrecognized input is preserved so the owning form can show a validation error.
 */
export function CountryField({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  europeOnly = false,
  inputRef,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
  europeOnly?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
}) {
  const list = useId();
  const options = countries.filter(
    (country) => !europeOnly || country.region === "Europe",
  );
  return (
    <>
      <input
        id={id}
        ref={inputRef}
        onBlur={onBlur}
        list={list}
        autoComplete="off"
        maxLength={100}
        placeholder="Search country or ISO code"
        value={countryName(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(resolveCountry(raw) ?? raw);
        }}
      />
      <datalist id={list}>
        {options.flatMap((country) =>
          [country.name, ...(aliases[country.code] ?? [])].map((name) => (
            <option key={`${country.code}:${name}`} value={name} label={country.code} />
          )),
        )}
      </datalist>
    </>
  );
}
