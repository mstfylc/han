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
      // ── React Compiler advisories, deliberately warnings ─────────────────
      //
      // Next 16 brings eslint-plugin-react-hooks v7, whose React Compiler rules
      // run even though `reactCompiler` is off in next.config.ts. Eighteen
      // remain, and each is a decision rather than a shrug. Where the rule found
      // a real defect it was fixed, not downgraded:
      //
      //   · Ara synced its search box to the URL inside an effect, so every
      //     back/forward flashed the previous query. Now adjusted during render.
      //   · İşlerim read Date.now() while rendering — a render that returns a
      //     different answer each time it runs is not a function of its inputs,
      //     which is exactly what makes the server's HTML and the client's first
      //     render disagree. The clock now lives in state and moves on the tick.
      //
      // What is left, and why:
      //
      //   purity (2) — Date.now() inside `submitClaim` and `doLogin`. These run
      //     on a click, and a claim has to be stamped with the moment the person
      //     pressed the button, not with the last tick. The compiler cannot see
      //     that an arrow function defined in the body is only ever a handler,
      //     so it flags conservatively. Contorting this would store worse data.
      //
      //   preserve-manual-memoization (6) — the ported engine mutates
      //     module-level state on purpose: applyOverrides rewrites a record in
      //     place, loadDrafts pushes onto RECORDS. So the compiler cannot prove
      //     a useMemo dependency derived from it is stable, and it is right that
      //     it cannot. Making the data layer immutable means rewriting the
      //     engine, and the engine is what scripts/parity.ts holds byte-for-byte
      //     against the design prototype — the rewrite would void the one
      //     guarantee that says this port is faithful. Not a good trade for a
      //     compiler that is not enabled.
      //
      //   set-state-in-effect (10) — the panel tabs read a client-only source
      //     after mount, because the server cannot read it at all: stored scope
      //     selections, the theme, the local mirror of a synced document.
      //     "Render empty, then fill in" is the honest shape for that; the
      //     alternative is rendering on the server something the server does not
      //     know, which is the SSR mismatch this avoids. With a fully async
      //     loader each becomes a real loading state — a change worth making
      //     when the documents are normalised, not before.
      //
      // An earlier version of this comment said `purity` was about reading
      // storage during render and would reach zero once the data moved to
      // Postgres. Both halves were wrong — it was the clock, and the fix had
      // nothing to do with Postgres. Corrected rather than left standing.
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
