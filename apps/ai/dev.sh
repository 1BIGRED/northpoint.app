#!/usr/bin/env bash
# Launches the FastAPI dev server. Auto-creates .venv on first run.
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "[ai] No venv found — creating .venv and installing deps..."
  python3 -m venv .venv
  .venv/bin/pip install --upgrade pip --quiet
  .venv/bin/pip install -e . --quiet
  echo "[ai] venv ready."
fi

exec .venv/bin/uvicorn main:app --reload --port 8000
