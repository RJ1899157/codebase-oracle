FROM python:3.11-slim

WORKDIR /app

# Install git for repository cloning and build essentials for tree-sitter
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY apps/api/pyproject.toml /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    fastapi \
    "uvicorn[standard]" \
    pydantic-settings \
    tree-sitter \
    tree-sitter-python \
    neo4j \
    httpx2 \
    pytest

COPY apps/api /app/apps/api
RUN pip install --no-cache-dir -e /app/apps/api

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "apps/api"]