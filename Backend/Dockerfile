FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cache mount keeps downloaded wheels across builds)
COPY pyproject.toml README.md ./
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install . && \
    pip uninstall -y opencv-python 2>/dev/null; \
    pip install opencv-python-headless

# Copy application
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Production stage
FROM base AS production
EXPOSE 8000
CMD ["uvicorn", "nisha.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

# Development stage
FROM base AS development
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -e ".[dev]"
CMD ["uvicorn", "nisha.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "src"]
