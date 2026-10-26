import type { PracticeDefinition } from "./contracts";
import { searchPracticeParts, type PracticePart } from "./practice-fitment";
export type PracticeSnapshot = {
  progress: {
    id: string;
    version: number;
    step: number;
    status: "active" | "completed";
    lastActivity: number;
  };
  values: Record<string, string>;
  results: PracticePart[] | null;
  reviewed: boolean;
  completed: boolean;
  feedback: string;
  errors: Record<string, string>;
};
export type PracticeCommand =
  | { type: "edit"; field: string; value: string }
  | { type: "example"; replace: boolean }
  | { type: "search" }
  | { type: "review"; choice: string }
  | { type: "reset"; nonce: string };
/** Pure in-memory simulator. No HTTP, API client, storage, cookie, timer or integration. */
export function createPracticeAdapter(
  definition: PracticeDefinition,
  nonce: string,
  clock = Date.now,
) {
  const empty = (): PracticeSnapshot => ({
    progress: {
      id: definition.id,
      version: definition.version,
      step: 0,
      status: "active",
      lastActivity: clock(),
    },
    values: {},
    results: null,
    reviewed: false,
    completed: false,
    feedback: "",
    errors: {},
  });
  let state = empty();
  function snapshot() {
    return structuredClone(state);
  }
  return {
    snapshot,
    execute(command: PracticeCommand) {
      if (!command || typeof command !== "object")
        throw new Error("Invalid practice command");
      if (command.type === "reset") {
        if (
          Object.keys(command).sort().join(",") !== "nonce,type" ||
          command.nonce !== nonce
        )
          throw new Error("Reset belongs to another practice session");
        state = empty();
        return snapshot();
      }
      if (command.type === "edit") {
        const field = definition.fields.find((f) => f.id === command.field);
        if (
          !field ||
          typeof command.value !== "string" ||
          command.value.length > field.max
        )
          throw new Error("Invalid fictional field");
        if (field.options && command.value && !field.options.includes(command.value))
          throw new Error("Invalid fictional option");
        state = {
          ...state,
          values: { ...state.values, [field.id]: command.value },
          completed: false,
          reviewed: false,
          feedback: "",
          results: null,
          errors: {},
        };
        const changed = new Set([field.id]);
        for (let i = 0; i < definition.fields.length; i++)
          for (const dependent of definition.fields)
            if (dependent.dependsOn && changed.has(dependent.dependsOn)) {
              delete state.values[dependent.id];
              changed.add(dependent.id);
            }
      } else if (command.type === "example") {
        if (Object.values(state.values).some(Boolean) && !command.replace)
          throw new Error("Review replacement before filling the fictional example");
        state = {
          ...empty(),
          values: Object.fromEntries(definition.fields.map((f) => [f.id, f.example])),
          feedback:
            "Fictional example inserted. Review and edit it; nothing was submitted.",
        };
      } else if (command.type === "search") {
        if (definition.kind !== "fitment")
          throw new Error("This exercise has no fictional catalogue");
        const valid = definition.fields.every((field) => {
          const value = (state.values[field.id] ?? "").trim();
          return (
            value.length >= field.min &&
            value.length <= field.max &&
            (!field.options || field.options.includes(value)) &&
            (!field.dependsOn || !!state.values[field.dependsOn])
          );
        });
        const results = valid ? searchPracticeParts(state.values) : [];
        state = {
          ...state,
          results,
          reviewed: false,
          completed: false,
          errors: valid
            ? {}
            : { search: "Complete the fictional vehicle and search fields first." },
          feedback: !valid
            ? "Check the fictional fields before searching."
            : results.length
              ? `${results.length} fictional candidates found. Open their evidence and compare the outcomes before reviewing your next step.`
              : "No fictional candidates match. Try Brake pads with the sample Toyota Corolla 2018. No live catalogue was searched.",
        };
      } else if (command.type === "review") {
        const errors: Record<string, string> = {};
        for (const field of definition.fields) {
          const value = (state.values[field.id] ?? "").trim();
          if (
            value.length < field.min ||
            value.length > field.max ||
            (field.options && !field.options.includes(value)) ||
            (field.dependsOn && !state.values[field.dependsOn])
          )
            errors[field.id] =
              `Enter ${field.label.toLowerCase()} (${field.min}–${field.max} characters).`;
        }
        const choice = definition.choices.find((c) => c.id === command.choice);
        if (definition.kind === "fitment" && !state.results?.length)
          errors.search =
            "Search the fictional catalogue and inspect its evidence before reviewing.";
        if (!choice) errors.choice = "Choose a fictional next step.";
        state = {
          ...state,
          errors,
          reviewed: !Object.keys(errors).length,
          completed:
            !Object.keys(errors).length && command.choice === definition.expected,
          feedback: Object.keys(errors).length
            ? "Check the fictional fields and choice below. Nothing was submitted."
            : choice!.feedback,
        };
      } else throw new Error("Unknown practice command");
      state.progress = {
        id: definition.id,
        version: definition.version,
        step: state.reviewed ? 1 : 0,
        status: state.completed ? "completed" : "active",
        lastActivity: clock(),
      };
      return snapshot();
    },
  };
}
