# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies + package. pip sees deps already satisfied on rebuilds
# when only main.py changes, so the heavy fastapi/uvicorn install stays cached.
COPY pyproject.toml main.py ./
RUN pip install .

# Copy supporting trees (currently empty placeholders; populated in later groups).
COPY clients/ ./clients/
COPY prompts/ ./prompts/

EXPOSE 8000

# Railway injects $PORT; fall back to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
