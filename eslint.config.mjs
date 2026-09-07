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
  {
    // FRONTEND.md: "3D-зависимости не должны попасть в бандл /app." three
    // and @react-three/* are only ever meant to load for the landing
    // scene — restrict the import at lint time so a stray import outside
    // components/landing/** fails the build instead of surfacing later
    // as a bundle-analyzer surprise.
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/landing/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["three", "three/*", "@react-three/*"],
              message:
                "three/@react-three/* is reserved for components/landing/** — the /app bundle must never load the 3D scene.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
