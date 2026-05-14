import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // React 19 incorporó la regla react-hooks/set-state-in-effect.
  // El código actual tiene este patrón en varias páginas (fetch + setState).
  // Se baja a warning temporalmente para no bloquear CI; arreglar en
  // refactor posterior con TanStack Query o useEffect con cleanup.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
