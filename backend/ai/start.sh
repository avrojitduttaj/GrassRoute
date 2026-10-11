#!/usr/bin/env bash
set -euo pipefail

export OLLAMA_HOST=127.0.0.1:11434
export OLLAMA_MODELS="${OLLAMA_MODELS:-/var/lib/ollama/models}"

mkdir -p "$OLLAMA_MODELS"

ollama serve > /tmp/ollama.log 2>&1 &

for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:11434/api/tags >/dev/null; then
    break
  fi
  sleep 2
done

if ! curl -fsS http://127.0.0.1:11434/api/tags >/dev/null; then
  cat /tmp/ollama.log
  echo "Ollama failed to start."
  exit 1
fi

# Pull Gemma in the background so FastAPI can start serving.
if ! ollama list | grep -q 'gemma3:4b'; then
  ollama pull gemma3:4b > /tmp/ollama-pull.log 2>&1 &
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-10000}"