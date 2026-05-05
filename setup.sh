#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# NISHA SENTINEL — Full Project Setup
# Run from the project root: ./setup.sh
# ─────────────────────────────────────────────────────────────

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/Backend"
FRONTEND_DIR="$ROOT_DIR/Frontend"
AI_DIR="$ROOT_DIR/ai/video_processing"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; }

# ─────────────────────────────────────────────────────────────
# 1. Prerequisite checks
# ─────────────────────────────────────────────────────────────
section() { echo -e "\n${CYAN}━━━ $1 ━━━${NC}\n"; }

check_cmd() {
    if command -v "$1" &>/dev/null; then
        ok "$1 found: $($1 --version 2>&1 | head -1)"
        return 0
    else
        fail "$1 not found"
        return 1
    fi
}

section "1/5  Checking prerequisites"

MISSING=0
check_cmd python3   || MISSING=1
check_cmd pip3      || check_cmd pip || MISSING=1
check_cmd node      || MISSING=1
check_cmd npm       || MISSING=1
check_cmd docker    || MISSING=1

if command -v docker &>/dev/null; then
    if docker compose version &>/dev/null; then
        ok "docker compose found"
    elif docker-compose --version &>/dev/null; then
        ok "docker-compose (v1) found"
        COMPOSE_CMD="docker-compose"
    else
        fail "docker compose plugin not found"
        MISSING=1
    fi
fi
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

if [ "$MISSING" -eq 1 ]; then
    echo ""
    fail "Install missing prerequisites before continuing."
    echo "  Ubuntu/Debian: sudo apt install python3 python3-pip python3-venv nodejs npm docker.io docker-compose-v2"
    echo "  macOS:         brew install python node docker"
    exit 1
fi

PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")
if [ "$PY_MAJOR" -lt 3 ] || [ "$PY_MINOR" -lt 11 ]; then
    fail "Python 3.11+ required (found $PY_MAJOR.$PY_MINOR)"
    exit 1
fi
ok "Python version $PY_MAJOR.$PY_MINOR meets requirement (>=3.11)"

# ─────────────────────────────────────────────────────────────
# 2. Backend
# ─────────────────────────────────────────────────────────────
section "2/5  Setting up Backend"

cd "$BACKEND_DIR"

if [ ! -d ".venv" ]; then
    info "Creating Python virtual environment..."
    python3 -m venv .venv
    ok "Virtual environment created"
else
    ok "Virtual environment already exists"
fi

source .venv/bin/activate

info "Installing Python dependencies..."
pip install --upgrade pip -q
pip install -e ".[dev]" -q
ok "Backend dependencies installed"

if [ ! -f ".env" ]; then
    info "Creating .env from .env.example..."
    cp .env.example .env
    # Generate random keys
    SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    JWT_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    sed -i "s|change-me-to-a-random-secret-key|$SECRET|" .env
    sed -i "s|change-me-to-a-secure-api-key|$API_KEY|" .env
    sed -i "s|change-me-jwt-secret|$JWT_KEY|" .env
    ok "Generated .env with random secrets"
    warn "Review Backend/.env and save the API_KEY — you'll need it for requests"
else
    ok ".env already exists, skipping"
fi

deactivate

# ─────────────────────────────────────────────────────────────
# 3. Docker services (PostgreSQL + Redis)
# ─────────────────────────────────────────────────────────────
section "3/5  Starting Docker services"

if ! docker info &>/dev/null; then
    warn "Docker daemon not running. Start it with: sudo systemctl start docker"
    warn "Skipping database setup — run this script again after starting Docker."
    DB_READY=0
else
    cd "$BACKEND_DIR"
    info "Starting PostgreSQL and Redis..."
    $COMPOSE_CMD up -d postgres redis

    info "Waiting for PostgreSQL to be ready..."
    RETRIES=30
    until docker exec "$(docker ps -q -f name=postgres)" pg_isready -U nisha -d nisha_sentinel &>/dev/null || [ "$RETRIES" -eq 0 ]; do
        RETRIES=$((RETRIES - 1))
        sleep 1
    done

    if [ "$RETRIES" -gt 0 ]; then
        ok "PostgreSQL is ready"
    else
        fail "PostgreSQL did not start in time"
        exit 1
    fi

    info "Running database migrations..."
    source .venv/bin/activate
    alembic upgrade head
    deactivate
    ok "Database migrations applied"
    DB_READY=1
fi

# ─────────────────────────────────────────────────────────────
# 4. Frontend
# ─────────────────────────────────────────────────────────────
section "4/5  Setting up Frontend"

cd "$FRONTEND_DIR"

info "Installing Node.js dependencies..."
npm install --silent 2>&1 | tail -1
ok "Frontend dependencies installed"

# ─────────────────────────────────────────────────────────────
# 5. AI Video Processing
# ─────────────────────────────────────────────────────────────
section "5/5  Setting up AI Video Processing"

cd "$AI_DIR"

if [ ! -d ".venv" ]; then
    info "Creating AI virtual environment..."
    python3 -m venv .venv
    ok "AI virtual environment created"
else
    ok "AI virtual environment already exists"
fi

source .venv/bin/activate

info "Installing PyTorch and ML dependencies..."

# Detect CUDA
HAS_CUDA=0
if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
    HAS_CUDA=1
    ok "NVIDIA GPU detected — installing PyTorch with CUDA"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128 -q 2>/dev/null || \
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121 -q
else
    info "No NVIDIA GPU detected — installing CPU-only PyTorch"
    pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu -q
fi

pip install -r requirements.txt -q
ok "AI dependencies installed"

# Check dataset
DATASET_DIR="$AI_DIR/violence dataset/real life violence situations/Real Life Violence Dataset"
if [ -d "$DATASET_DIR/Violence" ] && [ -d "$DATASET_DIR/NonViolence" ]; then
    V_COUNT=$(ls "$DATASET_DIR/Violence/"*.mp4 2>/dev/null | wc -l)
    NV_COUNT=$(ls "$DATASET_DIR/NonViolence/"*.mp4 2>/dev/null | wc -l)
    ok "Dataset found: $V_COUNT violence + $NV_COUNT non-violence videos"
else
    warn "Dataset not found at: $DATASET_DIR"
    warn "Transfer the 'violence dataset' folder to: $AI_DIR/"
fi

# Check if preprocessed data exists
if [ -f "$AI_DIR/data/train/sequences.npy" ]; then
    ok "Preprocessed data already exists"
else
    info "Preprocessed data not found. Run these steps when ready:"
    echo "    cd $AI_DIR"
    echo "    source .venv/bin/activate"
    echo "    python3 preprocess.py    # ~30-60 min, extracts keypoints"
    echo "    python3 train.py         # ~5-15 min, trains LSTM"
    echo "    python3 evaluate.py      # evaluates on test set"
fi

deactivate

# ─────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━ Setup Complete ━━━${NC}"
echo ""
echo "  Start everything:"
echo ""
echo "    # Terminal 1 — Backend API"
echo "    cd $BACKEND_DIR"
echo "    source .venv/bin/activate"
echo "    uvicorn nisha.main:app --reload --reload-dir src"
echo ""
echo "    # Terminal 2 — Frontend"
echo "    cd $FRONTEND_DIR"
echo "    npm run dev"
echo ""
echo "    # Terminal 3 — AI pipeline (one-time)"
echo "    cd $AI_DIR"
echo "    source .venv/bin/activate"
echo "    python3 preprocess.py && python3 train.py && python3 evaluate.py"
echo ""
if [ "${DB_READY:-0}" -eq 0 ]; then
    echo -e "  ${YELLOW}Note: Docker was not running. Start Docker and re-run this script${NC}"
    echo -e "  ${YELLOW}to set up PostgreSQL, Redis, and run migrations.${NC}"
    echo ""
fi
echo "  Ports:"
echo "    Backend API:  http://localhost:8000"
echo "    Frontend:     http://localhost:3000"
echo "    PostgreSQL:   localhost:5432"
echo "    Redis:        localhost:6379"
echo ""
