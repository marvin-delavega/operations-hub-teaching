import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  // CommonJS files use require() — don't apply TypeScript import rules.
  {
    files: ["**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Underscore-prefixed args/vars are intentionally-unused placeholders
  // (_req, _prefix, _safetyStock, …) — honor the convention.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Design-system guardrails (see CLAUDE.md → "UI Consistency"). These fail the
  // build so UI drift can't merge silently — the reason they exist instead of a
  // prose convention.
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[value=/-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?![0-9])/]",
          message:
            "No raw Tailwind palette colors. Use a semantic token (bg-primary, text-critical, border-border, …) defined in app/globals.css.",
        },
        {
          selector:
            "TemplateElement[value.cooked=/-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|100|200|300|400|500|600|700|800|900|950)(?![0-9])/]",
          message:
            "No raw Tailwind palette colors. Use a semantic token (bg-primary, text-critical, border-border, …) defined in app/globals.css.",
        },
        {
          selector: "Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message:
            "No hardcoded hex colors in className. Use a semantic token defined in app/globals.css.",
        },
        {
          selector: "TemplateElement[value.cooked=/\\[#[0-9a-fA-F]{3,8}\\]/]",
          message:
            "No hardcoded hex colors in className. Use a semantic token defined in app/globals.css.",
        },
        {
          selector: "Literal[value=/(?<![-\\w])font-mono/]",
          message:
            "No raw font-mono in className. Use the type-data role class (app/globals.css) — mono styling lives in the named type scale.",
        },
        {
          selector: "TemplateElement[value.cooked=/(?<![-\\w])font-mono/]",
          message:
            "No raw font-mono in className. Use the type-data role class (app/globals.css) — mono styling lives in the named type scale.",
        },
        {
          selector: "Literal[value=/(?<!motion-safe:)active:scale/]",
          message:
            "Gate tap animation behind reduced-motion: use motion-safe:active:scale-… (design-system requirement).",
        },
        {
          selector: "TemplateElement[value.cooked=/(?<!motion-safe:)active:scale/]",
          message:
            "Gate tap animation behind reduced-motion: use motion-safe:active:scale-… (design-system requirement).",
        },
      ],
    },
  },
];

export default eslintConfig;
