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
    rules: {
      // A leading underscore is the convention for "this argument exists to
      // hold a position in the signature". Several ported engine functions keep
      // arguments they no longer read so their shape stays comparable with the
      // prototype they were lifted from.
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
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Third-party and prototype files served as-is. Leaflet is vendored so
      // the map works offline; han-data.js is the copy the map iframe imports.
      // Neither is ours to restyle, and linting minified code says nothing.
      "public/**",
    ],
  },
];

export default eslintConfig;
