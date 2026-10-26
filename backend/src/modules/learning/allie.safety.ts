import { AllieFailure, allieOutputSchema, type AllieContext } from "./allie.contracts.js";

function luhn(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0,
    double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = Number(digits[index]);
    if (double && (digit *= 2) > 9) digit -= 9;
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

// Deliberately conservative screening, not a guarantee of complete detection.
// Reject rather than echo/redact secrets into a response or provider prompt.
export function containsAllieSecret(value: string) {
  const assignedSecrets = [
    ...value.matchAll(
      /\b(?:password|passcode|otp|one[- ]time (?:code|password)|recovery code|backup code|authenticator code|cvv|cvc|pin|access token|api key)\s*(?:is|=|:|are)\s*["']?([^\s"']{3,})/gi,
    ),
  ];
  return (
    /\b(?:sk-(?:proj-)?[a-z\d_-]{12,}|bearer\s+[a-z\d._~-]{12,}|eyJ[a-z\d_-]{8,}\.[a-z\d_-]+\.[a-z\d_-]+)\b/i.test(
      value,
    ) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value) ||
    assignedSecrets.some(
      (match) =>
        !/^(?:not|forgotten|lost|reset|expired|incorrect|unavailable|missing|wrong|needed|private|secret|safe|rejected)[.,!?]?$/i.test(
          match[1]!,
        ),
    ) ||
    /\b(?:my|the)\s+(?:verification\s+)?code\s+(?:is\s+)?\d{4,10}\b/i.test(value) ||
    [
      ...value.matchAll(
        /\b(?:account number|bank account|card number|sort code|routing number|iban)\s*(?:is|=|:)?\s*([a-z\d][a-z\d -]{6,})/gi,
      ),
    ].some((match) => (match[1]!.match(/\d/g)?.length ?? 0) >= 4) ||
    [...value.matchAll(/\b\d(?:[ -]?\d){12,18}\b/g)].some(([candidate]) =>
      luhn(candidate),
    )
  );
}

export function alliePlainText(value: string) {
  return (
    ![...value].some((character) => {
      const code = character.charCodeAt(0);
      return code === 127 || (code < 32 && ![9, 10, 13].includes(code));
    }) &&
    !/<\/?[a-z!]|\]\(|!\[|\b(?:https?:|javascript:|data:|www\.)/i.test(value) &&
    !containsAllieSecret(value)
  );
}

export function validateAllieOutput(value: unknown, context: AllieContext) {
  const parsed = allieOutputSchema.safeParse(value);
  if (!parsed.success) throw new AllieFailure("invalid_output");
  const output = parsed.data;
  const strings = [output.answer, ...output.steps, output.caveat ?? ""];
  if (
    strings.join(" ").length > 4000 ||
    strings.some((text) => !alliePlainText(text)) ||
    new Set(output.sourceIds).size !== output.sourceIds.length ||
    new Set(output.actionIds).size !== output.actionIds.length ||
    output.sourceIds.some((id) => !context.sources.some((source) => source.id === id)) ||
    (output.kind === "answer" && output.sourceIds.length === 0) ||
    output.actionIds.some((id) => {
      const action = context.actions.find((entry) => entry.id === id);
      return (
        !action ||
        (action.sourceId !== null && !output.sourceIds.includes(action.sourceId))
      );
    }) ||
    // The initial assistant has no operational tools or record lookup.
    strings.some((text) =>
      /\b(?:I|we)(?:'ve| have)?\s+(?:sent|submitted|approved|reserved|booked|updated|changed|queued|emailed|notified|saved|deleted|checked your|looked up your)\b/i.test(
        text,
      ),
    )
  )
    throw new AllieFailure("invalid_output");
  return {
    ...output,
    sources: output.sourceIds.map((id) => {
      const { passage: _passage, ...source } = context.sources.find(
        (entry) => entry.id === id,
      )!;
      return source;
    }),
    actions: output.actionIds.map((id) =>
      context.actions.find((entry) => entry.id === id)!,
    ),
  };
}
