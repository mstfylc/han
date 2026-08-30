#!/usr/bin/env bash
# Restart the production server on :3000 and prove it is serving THIS build.
#
# Three things this has to get right, each learned from a run that lied:
#
#   · `npm run start` spawns next-server as a child, so killing the npm wrapper
#     orphans the server and it keeps holding the port.
#   · `ss -lptn` reports no pid in some containers, so a kill loop built only on
#     it silently kills nothing. The old server then keeps the port, the new one
#     dies with EADDRINUSE, and the readiness check below is happily satisfied
#     BY THE OLD SERVER — which by then is serving a build whose files `next
#     build` has already deleted, so every page 500s.
#   · Chunk filenames are content-hashed and stay identical when the entry did
#     not change, so "a chunk the page references exists on disk" was too weak a
#     staleness signal. The build id changes every build; that is the check.
set -u
cd "$(dirname "$0")/.."

PORT=3000

pids_on_port() {
  # Several ways, because no single one works everywhere.
  { fuser -n tcp "$PORT" 2>/dev/null
    ss -lptnH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2
    lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null
  } | tr ' ' '\n' | grep -E '^[0-9]+$' | sort -u
}

for pid in $(pids_on_port); do kill "$pid" 2>/dev/null; done
for _ in $(seq 1 10); do
  [ -z "$(pids_on_port)" ] && break
  sleep 1
done
# Still there: escalate rather than start a server that cannot bind.
for pid in $(pids_on_port); do kill -9 "$pid" 2>/dev/null; done
sleep 1

if [ -n "$(pids_on_port)" ]; then
  echo "port $PORT is still held by: $(pids_on_port | tr '\n' ' ')"
  exit 1
fi

nohup npm run start >/tmp/han-next.log 2>&1 &

WANT=$(cat .next/BUILD_ID 2>/dev/null || echo "")
if [ -z "$WANT" ]; then
  echo "no .next/BUILD_ID — run npm run build first"
  exit 1
fi

for i in $(seq 1 40); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null)" = "200" ]; then
    # The build id is written fresh by every build, so this cannot be satisfied
    # by a server left over from the previous one.
    GOT=$(curl -s "http://localhost:$PORT/api/build" 2>/dev/null | grep -o '"buildId":"[^"]*"' | cut -d'"' -f4)
    if [ "$GOT" != "$WANT" ]; then
      echo "server is serving a different build (want $WANT, got ${GOT:-none})"
      tail -20 /tmp/han-next.log
      exit 1
    fi
    echo "server up after ${i}s, build $WANT"
    exit 0
  fi
  sleep 1
done

echo "server did not come up; last 20 log lines:"
tail -20 /tmp/han-next.log
exit 1
