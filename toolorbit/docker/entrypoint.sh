#!/bin/sh
# Starts the Next.js server, then refreshes pages that were prerendered at build
# time (without database access) so they show live settings immediately.
set -e
node server.js &
PID=$!
trap 'kill -TERM $PID 2>/dev/null; wait $PID' TERM INT
if [ -n "$INTERNAL_API_SECRET" ]; then
  for i in $(seq 1 30); do
    if node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
      node -e "fetch('http://127.0.0.1:3000/api/internal/revalidate',{method:'POST',headers:{'x-internal-secret':process.env.INTERNAL_API_SECRET}}).then(r=>console.log('[entrypoint] cache refresh:',r.status)).catch(e=>console.error('[entrypoint] cache refresh failed',e.message))"
      break
    fi
    sleep 2
  done
fi
wait $PID
