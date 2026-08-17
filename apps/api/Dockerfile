FROM python:3.11-slim

WORKDIR /app

# Install git for repository cloning and build essentials for tree-sitter
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONPATH=/app/apps/api \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=100 \
    PIP_RETRIES=5

# Pre-install pip, setuptools, wheel to prevent isolated build PyPI 502 errors
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    pydantic-settings \
    python-dotenv \
    tree-sitter \
    tree-sitter-python \
    neo4j \
    pytest

COPY apps/api /app/apps/api

# Install with --no-build-isolation so it uses local pre-installed setuptools/wheel
RUN pip install --no-cache-dir --no-build-isolation -e /app/apps/api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "apps/api"]