import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Playwright's fixture pattern passes a callback literally named `use`
    // (`async ({ db }, use) => { await use(db); }`), which the react-hooks
    // naming heuristic mistakes for React's `use()` hook. These are test
    // fixtures, not components, so the rule does not apply here.
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // `vercel build` output, same class of generated artefact as `.next`.
    ".vercel/**",
  ]),
]);

export default eslintConfig;
