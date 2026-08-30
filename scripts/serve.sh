#!/usr/bin/env bash
# Restart the production server and wait until it answers with the CURRENT build.
#
# Two things this has to get right:
#   · `npm run start` spawns next-server as a child, so killing the npm wrapper
#     orphans the server and it keeps holding port 3000 — which then serves the
#     previous build's HTML and 400s on every chunk.
#   · The port must actually be free before we start, or the new server exits
#     and the stale one keeps answering.
set -u
cd "$(dirname "$0")/.."

# Kill whatever owns port 3000, wrapper and server alike.
for pid in $(ss -lptnH 'sport = :3000' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
  kill "$pid" 2>/dev/null
done
# Deliberately NOT `pkill -f next-server`: that pattern also matches the
# development server on :3001, so restarting the production build was silently
# killing the dev server the auth checks run against. Owning port 3000 is the
# only thing that makes a process ours to stop.

for i in $(seq 1 15); do
  curl -s -o /dev/null --max-time 1 http://localhost:3000/ 2>/dev/null || break
  sleep 1
done

nohup npm run start >/tmp/han-next.log 2>&1 &

for i in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null)" = "200" ]; then
    # Prove the running server is serving the build that is on disk.
    #
    # Match any chunk path rather than a specific naming scheme: webpack emitted
    # `chunks/app/(app)/page-<hash>.js`, Turbopack (the Next 16 default) emits
    # `chunks/<hash>.js`. The old pattern silently matched nothing on Next 16,
    # which turned this staleness check into a no-op that always "passed".
    ref=$(curl -s http://localhost:3000/ | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)
    if [ -z "$ref" ]; then
      echo "server answered 200 but served no chunk reference — cannot verify the build"
      exit 1
    fi
    if [ ! -f ".next/${ref#/_next/}" ]; then
      echo "server is serving a stale build ($ref not on disk)"
      exit 1
    fi
    echo "server up after ${i}s, serving ${ref##*/}"
    exit 0
  fi
  sleep 1
done

echo "server did not come up; last 20 log lines:"
tail -20 /tmp/han-next.log
exit 1
