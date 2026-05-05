# NISHA Sentinel - Complete Git Configuration & Documentation Index

This repository contains a complete distributed surveillance system with multi-component architecture. This index provides git configuration and documentation for each component.

---

## 📂 Repository Structure & Git Config

Each major component has its own `.gitignore`, commit templates, branch strategy, and setup guide:

```
NISHA_SENTINEL/
├── .gitignore                    # Root gitignore (all components)
├── docs/                         # All documentation
│   ├── README.md                # Documentation index (this tree)
│   ├── ARCHITECTURE.md          # Full system architecture
│   ├── backend_setup.md         # Backend git config + setup
│   ├── frontend_setup.md        # Frontend git config + setup
│   ├── master_setup.md          # Master node git config + setup
│   ├── mobile_agent_setup.md    # Mobile app git config + setup
│   └── esp32_agent_setup.md     # ESP32 firmware git config + setup
│
├── Backend/                      # FastAPI backend
│   ├── .gitignore              # Python, AI models, env, migrations
│   ├── src/nisha/              # Application code
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── pyproject.toml
│
├── Frontend/                     # Next.js dashboard
│   ├── .gitignore              # node_modules, .next, .env, builds
│   ├── src/
│   ├── package.json
│   └── next.config.ts
│
├── masters/                      # Master node (Raspberry Pi)
│   ├── .gitignore              # Python, buffers, logs
│   ├── src/nisha_master/
│   └── static/                 # Dashboard UI
│
├── Nisha-mobile-agent/           # React Native mobile app
│   ├── .gitignore              # Expo builds, node_modules, iOS/Android
│   ├── frontend/               # Expo app source
│   │   ├── app/
│   │   ├── src/
│   │   └── package.json
│   └── backend/                # Auxiliary FastAPI (mobile-specific)
│
└── agents/                       # Edge firmware
    └── esp32_s3_agent/
        ├── .gitignore          # PlatformIO, builds, secrets
        ├── src/main.cpp
        └── platformio.ini
```

---

## 🎯 Git Configuration by Component

### 1. Backend (`Backend/.gitignore` included)

**Commit Template:**
```
type(scope): description

Types: feat, fix, docs, style, refactor, perf, test, chore, infra, ai
Scopes: agent, master, audio, video, topology, handoff, failover, 
        config, command, ws, api, db, models, ai, infra
```

**Branch Strategy:**
```
main       → Production releases
develop    → Integration (optional)
feature/*  → feat/agent-health, feat/video-processing
bugfix/*   → bugfix/ws-reconnect
release/*  → Prep for release
```

**CI/CD**: `.github/workflows/ci.yml` (recommended)
- Lint: Ruff
- Type check: MyPy (strict)
- Unit tests: pytest (markers: unit, integration)
- Integration tests: require Postgres + Redis

---

### 2. Frontend (`Frontend/.gitignore` included)

**Commit Template:**
```
type(scope): description

Types: feat, fix, docs, style, refactor, perf, test, chore, infra
Scopes: dashboard, map, topology, agents, alerts, audio, video,
        components, store, services, websocket, api, ui, theme
```

**Branch Strategy:**
```
main      → Production
develop   → Integration
feature/* → feat/dashboard-maps, feat/real-time-alerts
bugfix/*  → fix/websocket-reconnect
```

**CI/CD**: `.github/workflows/frontend.yml`
- Lint: ESLint
- Type check: TypeScript (`tsc --noEmit`)
- Build: `npm run build` (verifies production build)

---

### 3. Master Node (`masters/.gitignore` included)

**Commit Template:**
```
type(scope): description

Types: feat, fix, docs, refactor, perf, test, chore, infra
Scopes: agent, backend, dashboard, buffer, hardware, triangulation,
        ws, queue, failover, handoff, config
```

**Branch Strategy:**
```
main      → Stable releases
develop   → Integration
feature/* → feat/handoff-protocol, feat/buffer-manager
bugfix/*  → fix/agent-connection-drop
```

**Systemd Service** (production):
```ini
[Unit]
Description=NISHA Master Node
After=network.target

[Service]
Type=simple
ExecStart=/opt/master/.venv/bin/uvicorn nisha_master.main:app
Restart=always

[Install]
WantedBy=multi-user.target
```

---

### 4. Mobile Agent (`Nisha-mobile-agent/.gitignore` included)

**Commit Template:**
```
type(scope): description

Types: feat, fix, docs, style, refactor, perf, test, chore, infra
Scopes: camera, audio, location, stream, ws, sensor, ui, navigation,
        store, permissions, background, protocol
```

**Branch Strategy:**
```
main      → EAS production builds
develop   → Integration
feature/* → feat/background-location, feat/audio-streaming
bugfix/*  → fix/permissions-crash
```

**EAS Build** (`eas.json`):
```json
{
  "build": {
    "development": { "developmentClient": true },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

---

### 5. ESP32 Firmware (`agents/esp32_s3_agent/.gitignore` included)

**Commit Template:**
```
type(scope): description

Types: feat, fix, docs, style, refactor, perf, test, chore
Scopes: i2s, wifi, ws, audio, sensor, protocol, power, ota
```

**Branch Strategy:**
```
main      → Stable firmware
develop   → Testing
feature/* → feat/ota-updates, feat/low-power-mode
bugfix/*  → fix/ws-reconnect-flood
```

**Security Note**: Before committing, move WiFi credentials to `config.h` (gitignored):
```cpp
// config.h (NOT committed)
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-pass"
#define MASTER_HOST "192.168.1.155"
```

---

## 📖 Documentation Files

### Core Documentation

| File | Purpose |
|------|---------|
| `docs/README.md` | Master index of all docs (this file) |
| `docs/ARCHITECTURE.md` | Complete technical deep-dive (all components) |
| `STARTUP_GUIDE.md` | Quick command reference (ports, order) |
| `SYSTEM_OPERATIONS.md` | Operational procedures, troubleshooting |
| `Nisha_integration_PRD.md` | Product requirements, API contracts |

### Component Guides (in `docs/`)

| Guide | Contents |
|-------|----------|
| `backend_setup.md` | Backend .gitignore, commit template, Docker, dev setup |
| `frontend_setup.md` | Frontend .gitignore, commit template, env vars, architecture |
| `master_setup.md` | Master .gitignore, Dockerfile, systemd service, dashboard |
| `mobile_agent_setup.md` | Mobile .gitignore, EAS config, permissions, streaming |
| `esp32_agent_setup.md` | ESP32 .gitignore, PlatformIO, wiring, flashing, security |

---

## 🔧 Git Commands Quick Reference

### Initialize (if not already)

```bash
git init
git add .
git commit -m "chore: initial commit - project skeleton"
```

### Add All Gitignores

```bash
# These are already created:
git add Backend/.gitignore Frontend/.gitignore masters/.gitignore \
        Nisha-mobile-agent/.gitignore agents/esp32_s3_agent/.gitignore \
        ai/.gitignore .gitignore
```

### Pre-commit Hooks (Recommended)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Backend
if git diff --cached --name-only | grep -q "^Backend/"; then
    (cd Backend && ruff check src/)
    (cd Backend && mypy src/)
fi

# Frontend
if git diff --cached --name-only | grep -q "^Frontend/"; then
    (cd Frontend && npm run lint)
    (cd Frontend && npx tsc --noEmit)
fi

# If any command fails, prevent commit
if [ $? -ne 0 ]; then
    echo "Pre-commit checks failed."
    exit 1
fi
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

---

## 📦 Package Managers by Component

| Component | Package Manager | Lock File |
|-----------|----------------|-----------|
| Backend | pip (Python) | `pyproject.toml` (PEP 660) |
| Frontend | npm/yarn | `package-lock.json` / `yarn.lock` |
| Master | pip (Python) | `pyproject.toml` (suggested) |
| Mobile | npm/yarn (Expo) | `package-lock.json` |
| ESP32 | PlatformIO | `platformio.ini` |
| AI | pip + conda | `requirements.txt` (suggested) |

---

## 🐳 Docker & Deployment

### Docker Compose (Full Stack)

```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```

### Production Deployment

**Option 1: Docker Swarm / Kubernetes**
- Build images, push to registry
- Deploy with `docker stack deploy` or K8s manifests

**Option 2: Systemd (per service)**

```bash
# /etc/systemd/system/nisha-backend.service
[Unit]
Description=NISHA Backend
After=postgresql.service redis.service

[Service]
Type=simple
WorkingDirectory=/opt/nisha/Backend
User=nisha
Environment="DATABASE_URL=..."
ExecStart=/opt/nisha/Backend/.venv/bin/uvicorn nisha.main:app \
  --host 0.0.0.0 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 📝 Documentation Standards

All `.md` files should follow:

1. **Headers**: ATX style (`#`, `##`, `###`)
2. **Code blocks**: Use triple backticks with language
   ```python
   # Python
   ```
   ```bash
   # Shell
   ```
   ```yaml
   # YAML
   ```
3. **Tables**: Markdown pipe tables
4. **Links**: Relative paths within repo
   - `[Backend](Backend/README.md)`
5. **Diagrams**: Mermaid (if supported) or ASCII art

---

## 🔄 Continuous Integration (Suggested)

### Root `.github/workflows/ci.yml`

```yaml
name: NISHA Sentinel CI

on: [push, pull_request]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with: { python-version: '3.11' }
      - name: Install
        working-directory: Backend
        run: pip install -e ".[dev]"
      - name: Lint
        working-directory: Backend
        run: ruff check src/
      - name: Type check
        working-directory: Backend
        run: mypy src/
      - name: Test
        working-directory: Backend
        run: pytest
        env:
          DATABASE_URL: postgresql+asyncpg://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379/0

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with: { node-version: '20', cache: 'npm', cache-dependency-path: Frontend/package-lock.json }
      - name: Install
        working-directory: Frontend
        run: npm ci
      - name: Lint
        working-directory: Frontend
        run: npm run lint
      - name: Build
        working-directory: Frontend
        run: npm run build
```

---

## 🗂️ File Naming Conventions

- Python modules: `snake_case.py`
- TypeScript/JS: `kebab-case.tsx` for components, `camelCase.ts` for utilities
- C++: `snake_case.cpp`
- Config: `config.py`, `settings.py`, `.env`, `*.toml`, `*.ini`
- Dockerfiles: `Dockerfile` (capitalized)
- Documentation: `UPPER_SNAKE_CASE.md` or `Title-Case.md`

---

## 📊 Repository Health Metrics

Track these in your README badge:

- **Build status** (CI)
- **Code coverage** (Codecov)
- **Dependencies** (Dependabot)
- **License** (MIT)
- **Version** (semver)

Example badges:
```
[![CI](https://github.com/user/repo/workflows/CI/badge.svg)]
[![codecov](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)]
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)]
```

---

## 🤝 Contribution Workflow

```
1. Fork / clone
2. git checkout -b feature/your-feature
3. Make changes (follow style guides)
4. Run tests & linters
5. git commit -m "feat(scope): description"
6. git push origin feature/your-feature
7. Open Pull Request to main
8. CI passes → review → merge
```

---

## 📞 Getting Help

- **Architecture questions**: Read `docs/ARCHITECTURE.md`
- **Setup issues**: See component-specific `*_setup.md` files
- **Runtime errors**: Check `SYSTEM_OPERATIONS.md` troubleshooting
- **Git questions**: See commit templates in this directory

---

**Last Updated**: 2026-05-04  
**Maintained By**: NISHA Sentinel Development Team  
**Document Version**: 1.0
