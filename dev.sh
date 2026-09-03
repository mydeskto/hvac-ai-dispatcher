#!/usr/bin/env bash
# Starts the Express API (port 4000) and the Next.js frontend (port 3000).
set -euo pipefail
cd "$(dirname "$0")"

npm --prefix backend run dev &
BACKEND_PID=$!
npm --prefix frontend run dev &
FRONTEND_PID=$!

trap 'kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true' EXIT
wait
