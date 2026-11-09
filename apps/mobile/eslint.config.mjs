import { defineConfig } from "eslint/config";
import expo from "eslint-config-expo/flat.js";
import prettier from "eslint-config-prettier/flat";
export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      ".expo/**",
      "dist/**",
      "coverage/**",
      "src/api/contracts/generated.d.ts",
    ],
  },
  expo,
  prettier,
]);
