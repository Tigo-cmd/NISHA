# NISHA Frontend - Git Configuration

## Repository: Frontend/

### .gitignore for Frontend/

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
.nyc_output

# Next.js
.next/
out/
build/

# Production
dist/
*.log

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Misc
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Expo (if used for web)
.expo/
web-build/
```

### Commit Message Template for Frontend/

```
type: scope (short description)

Longer description if needed.

Types:
feat:     New feature
fix:      Bug fix
docs:     Documentation only
style:    CSS/styling, no functional change
refactor: Code restructuring
perf:     Performance optimization
test:     Tests
chore:    Build, CI, dependencies
```

### Scopes for Frontend

```
dashboard, map, topology, agents, alerts, audio, video,
components, store, services, websocket, api, ui, theme,
navigation, types, utils
```

### Example Commits

```
feat(dashboard): add NetworkTopology SVG graph component

- Implements force-directed layout with pan/zoom
- Shows master-agent relationships with animated edges
- Hover tooltips with RSSI, battery, status
- 60fps rendering with requestAnimationFrame

fix(map): handle Mapbox token missing gracefully
- Shows fallback message if token not configured
- Prevents runtime error on component mount
- Adds .env.example documentation

style(theme): update color scheme to match cyberpunk spec
- Agent primary: #00F0FF (cyan)
- Master primary: #B026FF (purple)
- Background: #0A0A0F
- Status colors: success/warning/error variants

refactor(store): consolidate agent update logic
- Merges partial updates correctly
- Prevents stale data overwrites
- Adds immutability guarantees
```

### Branch Strategy

```
main      → Production
develop   → Integration (optional)
feature/* → feat/dashboard-maps, feat/real-time-alerts
bugfix/*  → hotfix/websocket-reconnect
```

### GitHub Actions (`.github/workflows/frontend.yml`)

```yaml
name: Frontend CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: Frontend/package-lock.json
      - name: Install
        working-directory: Frontend
        run: npm ci
      - name: Lint
        working-directory: Frontend
        run: npm run lint
      - name: Type check
        working-directory: Frontend
        run: npx tsc --noEmit

  build:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: Frontend/package-lock.json
      - name: Install
        working-directory: Frontend
        run: npm ci
      - name: Build
        working-directory: Frontend
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: https://api.example.com
          NEXT_PUBLIC_WS_URL: wss://api.example.com/ws
          NEXT_PUBLIC_MAPBOX_TOKEN: dummy
```

### Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1/ws/realtime
NEXT_PUBLIC_API_KEY=change-me-secure-key
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-mapbox-token
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

### Development Setup

```bash
cd Frontend
npm install
npm run dev  # → http://localhost:3000
```

### Architecture Notes

- **Framework**: Next.js 16.2.4 App Router
- **State**: Zustand (global store with AsyncStorage persistence)
- **Styling**: Tailwind CSS 4 + custom CSS
- **Real-time**: WebSocket native + Socket.IO fallback
- **Visualization**: Mapbox GL, Google Maps, Three.js (React Fiber), Konva, D3
- **UI Kit**: Custom components (no shadcn/ui, but similar patterns)
- **Navigation**: Expo Router (mobile) / Next.js Router (web)

### Important Files

```
src/
├── app/                    # Next.js pages (App Router)
│   ├── dashboard/          # Protected dashboard routes
│   └── layout.tsx          # Root layout
├── components/
│   ├── dashboard/          # Dashboard-specific components
│   │   ├── DataLoader.tsx  # Data orchestration (REST+WS)
│   │   ├── AgentDrawer.tsx # Agent detail panel
│   │   ├── MapView.tsx     # Mapbox implementation
│   │   ├── NetworkTopology.tsx  # SVG graph
│   │   └── TacticalOverlay.tsx  # Konva canvas
│   └── ui/                 # Reusable UI primitives
├── store/useStore.ts       # Zustand global state
├── services/
│   ├── apiService.ts       # REST client
│   └── websocketService.ts # WS manager
└── types/index.ts          # TypeScript interfaces
```

---
