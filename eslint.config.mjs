// Next 16 ships `eslint-config-next` as a native flat config array, so it is
// spread directly. The FlatCompat shim this project used on Next 15 now throws
// ("property 'react' closes the circle") because it re-wraps a config that is
// already flat.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // ── React Compiler advisories, deliberately warnings for now ──────────
      //
      // Next 16 brings eslint-plugin-react-hooks v7, whose React Compiler rules
      // run even though `reactCompiler` is off in next.config.ts. They are not
      // noise — they point at exactly the code the Postgres migration has to
      // restructure, so they are tracked rather than silenced:
      //
      //   purity — screens call OF.offersOf()/declineOf() during render, which
      //     reads storage. Once reads go to the API they become async and MUST
      //     move out of render anyway. Expected to reach zero in that phase.
      //   preserve-manual-memoization — the ported engine mutates records in
      //     place (applyOverrides rewrites rec.band, rec.status), so the
      //     compiler cannot prove a useMemo dependency is stable. Fixing it
      //     means making the data layer immutable, which is its own change.
      //
      //   set-state-in-effect — the panel and the role hook read a synchronous
      //     browser store after mount, because the server cannot read it at
      //     all. That "render empty, then fill in" step is unavoidable while
      //     the store is localStorage; with an API it becomes a real loading
      //     state. Where this rule caught a genuine defect it was fixed rather
      //     than downgraded (see the search box in Ara).
      //
      // All three stay visible in every lint run; none is switched off.
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/set-state-in-effect": "warn",

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
      // The design handoff is the source of record, kept byte-identical to what
      // Claude Design exported. Linting it would invite edits that break parity.
      "design/**",
    ],
  },
];

export default eslintConfig;
