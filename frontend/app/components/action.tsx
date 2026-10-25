import Link from "next/link";
import type { ComponentProps } from "react";

type ActionVariant = "primary" | "secondary" | "tertiary" | "danger";
const classes = (variant: ActionVariant, className?: string) =>
  ["button", "ui-action", variant, className].filter(Boolean).join(" ");

/** Buttons change state; ActionLink preserves navigation and browser link behaviour. */
export function ActionButton({
  variant = "primary",
  type = "button",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ActionVariant }) {
  return <button {...props} type={type} className={classes(variant, className)} />;
}

export function ActionLink({
  variant = "navigation",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ActionVariant | "navigation" }) {
  return (
    <Link
      {...props}
      className={
        variant === "navigation"
          ? ["ui-navigation", className].filter(Boolean).join(" ")
          : classes(variant, className)
      }
    />
  );
}

/** Selection is state, not a navigation destination or an implied submit. */
export function SelectionButton({
  selected,
  ...props
}: Omit<ComponentProps<typeof ActionButton>, "aria-pressed" | "variant"> & {
  selected: boolean;
}) {
  return <ActionButton {...props} variant="secondary" aria-pressed={selected} />;
}
