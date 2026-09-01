#!/usr/bin/env bash
# Start a local Postgres for development, and create the database if needed.
#
# Idempotent: safe to run when it is already up. The end-to-end scripts need a
# real database, so this is what makes "clone and run the checks" work.
set -u
PGBIN=/usr/lib/postgresql/16/bin
PGDATA=${PGDATA:-/var/lib/postgresql/handata}
PORT=${PGPORT:-5433}
cd "$(dirname "$0")/.."

if [ ! -d "$PGDATA/base" ]; then
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA" 2>/dev/null || true
  chmod 700 "$PGDATA"
  su postgres -c "PATH=$PGBIN:\$PATH initdb -D $PGDATA -U han --auth=trust -E UTF8" >/tmp/initdb.log 2>&1 \
    || { echo "initdb failed:"; tail -5 /tmp/initdb.log; exit 1; }
fi

if ! "$PGBIN/pg_isready" -h /tmp -p "$PORT" >/dev/null 2>&1; then
  su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D $PGDATA -l /tmp/pg.log -o '-p $PORT -k /tmp' start" >/dev/null 2>&1
  for _ in $(seq 1 15); do
    "$PGBIN/pg_isready" -h /tmp -p "$PORT" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if ! "$PGBIN/pg_isready" -h /tmp -p "$PORT" >/dev/null 2>&1; then
  echo "postgres did not start; last log lines:"; tail -10 /tmp/pg.log; exit 1
fi

"$PGBIN/createdb" -h /tmp -p "$PORT" -U han han 2>/dev/null
"$PGBIN/psql" -h /tmp -p "$PORT" -U han -d han -q -f db/schema.sql
echo "postgres ready on :$PORT (database 'han')"
