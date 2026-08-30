#!/usr/bin/env bash
# A development server on :3001, for the checks that need development mode.
#
# `next start` runs in production, where the password-reset code is deliberately
# NOT returned by the API — there is no SMS gateway here, so without dev mode
# the reset flow cannot be completed by a test. That guard is the correct
# behaviour and scripts/auth.mjs asserts it separately against :3000.
set -u
cd "$(dirname "$0")/.."

for pid in $(ss -lptnH 'sport = :3001' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
  kill "$pid" 2>/dev/null
done
sleep 1

nohup npx next dev -p 3001 >/tmp/han-next-dev.log 2>&1 &

for i in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/giris 2>/dev/null)" = "200" ]; then
    echo "dev server up after ${i}s"
    exit 0
  fi
  sleep 1
done

echo "dev server did not come up; last 20 lines:"
tail -20 /tmp/han-next-dev.log
exit 1
