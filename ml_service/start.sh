#!/bin/sh

set -eu

echo "▶️ Training collaborative filtering model..."
if python train_model.py; then
    echo "✅ Training finished"
else
    echo "⚠️ Training failed, starting API with fallback recommendations" >&2
fi

exec uvicorn app:app --host 0.0.0.0 --port 8000
