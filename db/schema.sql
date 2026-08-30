-- HAN — persistence schema.
--
-- WHAT THIS IS, HONESTLY: a document store in Postgres, not a normalised
-- relational model of the bazaar.
--
-- The reason is deliberate. The engine (han-scale, han-search, han-offers,
-- han-admin) was ported from the prototype and is held to it by
-- scripts/parity.ts, which proves all 1,385 records come out byte-identical.
-- That engine reads and writes whole JSON documents. Normalising the market
-- into tables would mean rewriting it, and the rewrite would silently void the
-- one guarantee that says the port is faithful. So the documents move to
-- Postgres first — real, shared, durable — and normalisation becomes a later
-- step that can be done a table at a time, each with its own test.
--
-- What this buys today is the thing that was actually missing: the surfaces
-- stop being three tabs in one browser. A trader's offer written on one device
-- reaches the buyer on another, and an officer's decision reaches everyone.

CREATE TABLE IF NOT EXISTS documents (
  -- 'shared' for the market's own state; 'user:<id>' for one person's.
  -- Which key is which is declared in src/services/storage.ts, so the client
  -- and the server cannot drift on it.
  scope       TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  value       JSONB       NOT NULL,
  -- Bumped on every write. The client sends the revision it last saw, so a
  -- stale tab cannot silently overwrite a newer decision.
  revision    BIGINT      NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

-- Polling asks "what changed since?", which is an ordered scan per scope.
CREATE INDEX IF NOT EXISTS documents_scope_updated_idx
  ON documents (scope, updated_at DESC);

-- ── the decision ledger ───────────────────────────────────────────────────
--
-- The approvals document is keyed by record, so writing a second decision for
-- the same record replaces the first: the document knows the current state but
-- forgets how it got there. The code's promise is stronger than that — "no
-- decision disappears silently, every one carries a reason and a time" — so
-- decisions are ALSO appended here, where nothing is ever overwritten.
--
-- This is what makes "why is this record suspended?" answerable next year.
CREATE TABLE IF NOT EXISTS decisions (
  id          BIGSERIAL   PRIMARY KEY,
  record_id   TEXT        NOT NULL,
  status      TEXT        NOT NULL,
  -- which of APPROVAL's grounds this rests on (han · saha · esnaf)
  via         TEXT,
  officer     TEXT,
  decided_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decisions_record_idx
  ON decisions (record_id, decided_at DESC);

-- ── operations accounts ───────────────────────────────────────────────────
--
-- These are real tables, not documents, and that is the point.
--
-- The prototype kept PINs, attempt counters and reset codes in localStorage.
-- It said so itself ("⚠ PROTOTİP"), and it was right: a PIN in the browser is
-- readable by any script on the origin, an attempt counter the client owns can
-- be reset by the client, and a "code sent to your phone" that lives in storage
-- can be read instead of received. None of that is a security boundary.
--
-- Here the secret never leaves the server: only a scrypt hash is stored, the
-- lockout counter is the server's, and reset codes are hashed, single-use and
-- expiring. The browser gets an opaque session token in an httpOnly cookie —
-- something JavaScript on the page cannot read at all.

CREATE TABLE IF NOT EXISTS ops_users (
  id          TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL DEFAULT '',
  -- Digits only, so "0532 111 22 33" and "05321112233" are the same person.
  tel         TEXT        NOT NULL UNIQUE,
  role        TEXT        NOT NULL DEFAULT 'okuma',
  place       TEXT,
  officer     TEXT,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  -- scrypt: 'scrypt$N$r$p$salt$hash'. NULL means "no password set yet", which
  -- is a state the sign-in screen has to handle rather than an error.
  pin_hash    TEXT,
  tries       INTEGER     NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ops_sessions (
  -- sha256 of the token. A leaked database cannot be replayed as a login.
  token_hash  TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES ops_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ops_sessions_user_idx ON ops_sessions (user_id);

CREATE TABLE IF NOT EXISTS ops_resets (
  code_hash   TEXT        PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES ops_users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ
);
