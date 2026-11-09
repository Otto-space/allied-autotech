import { Platform } from "react-native";
// Ported values, no imports from the web application. See SCAFFOLD_REPORT.md.
export const colors = {
  ink: "#080c0f",
  body: "#22262d",
  muted: "#626975",
  action: "#d71920",
  actionPressed: "#950e14",
  redOnDark: "#ff7378",
  navy: "#091b38",
  canvas: "#f5f6f8",
  surface: "#ffffff",
  line: "#d9dde3",
  success: "#166534",
  caution: "#854d0e",
  error: "#991b1b",
  white: "#ffffff",
} as const;
export const spacing = [4, 8, 12, 16, 24, 32] as const;
export const radius = { card: 16, control: 12 } as const;
export const touchTarget = Platform.OS === "ios" ? 44 : 48;
