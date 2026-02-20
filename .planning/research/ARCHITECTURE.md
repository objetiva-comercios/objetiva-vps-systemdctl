# Architecture Research

**Domain:** systemd admin panel (self-hosted Linux service management dashboard)
**Researched:** 2026-02-20
**Confidence:** HIGH

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NGINX / Caddy                             │
│              (reverse proxy + SSL termination)                   │
│            Handles WebSocket upgrade header forwarding           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP + WebSocket upgrade
┌──────────────────────────▼──────────────────────────────────────┐
│                    Node.js Process (root)                        │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                      │
│  │   HTTP Layer     │  │   WebSocket      │                      │
│  │                  │  │   Layer          │                      │
│  │  Express app     │  │  ws (noServer)   │                      │
│  │  + static serve  │  │  /ws/logs/:name  │                      │
│  │  /api/* routes   │  │  JWT auth on     │                      │
│  │                  │  │  upgrade event   │                      │
│  └────────┬─────────┘  └────────┬─────────┘                      │
│           │                     │                                │
│  ┌────────▼─────────────────────▼─────────────────────────────┐  │
│  │                     Middleware Stack                         │  │
│  │  helmet → rateLimit → auth (JWT verify) → audit → routes    │  │
│  └────────────────────────────┬───────────────────────────────┘  │
│                               │                                  │
│  ┌────────────────────────────▼───────────────────────────────┐  │
│  │                      Service Layer                           │  │
│  │                                                              │  │
│  │  ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │  │
│  │  │ SystemdService│  │  LogService   │  │UnitFileService │  │  │
│  │  │               │  │               │  │                │  │  │
│  │  │ execFile()    │  │ spawn() +     │  │ fs.readFile /  │  │  │
│  │  │ systemctl     │  │ journalctl -f │  │ fs.writeFile   │  │  │
│  │  │ whitelist     │  │ --output=json │  │ /etc/systemd/  │  │  │
│  │  │ of actions    │  │ stream→WS     │  │ system/        │  │  │
│  │  └───────────────┘  └───────────────┘  └────────────────┘  │  │
│  │                                                              │  │
│  │  ┌───────────────┐  ┌───────────────┐                        │  │
│  │  │ AuditService  │  │MonitorService │                        │  │
│  │  │               │  │               │                        │  │
│  │  │ better-sqlite3│  │ setInterval   │                        │  │
│  │  │ INSERT to     │  │ poll state →  │                        │  │
│  │  │ audit_log     │  │ compare +     │                        │  │
│  │  │               │  │ emit events   │                        │  │
│  │  └───────────────┘  └───────────────┘                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐  │
│  │   SQLite (WAL mode) │  │  systemd (os process)              │  │
│  │                     │  │                                    │  │
│  │  - users            │  │  systemctl (via execFile)          │  │
│  │  - audit_log        │  │  journalctl (via spawn -f)         │  │
│  │  - config           │  │  /etc/systemd/system/ (unit files) │  │
│  │  - watched_services │  │                                    │  │
│  └─────────────────────┘  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                           │ serves built assets
┌──────────────────────────▼──────────────────────────────────────┐
│                  React SPA (Vite build output)                   │
│              Served by Express as static files                   │
│                                                                  │
│  Pages: Login, Dashboard, Audit, Settings                        │
│  Components: ServiceList, LogViewer, UnitEditor, AuditLog        │
│  Hooks: useServices (polling), useWebSocket (logs), useAuth      │
│  State: Zustand (UI/auth state) + React Query (server data)      │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `server/index.js` | HTTP server lifecycle, WS upgrade handler, static serving | `http.createServer(app)` + ws `noServer` attach |
| `server/routes/*` | Route definitions, input validation, role enforcement | Express Router + Zod/manual validation |
| `server/middleware/auth.js` | JWT verification for HTTP and WS connections | `jsonwebtoken.verify()` |
| `server/middleware/audit.js` | Log every mutating HTTP action post-execution | Express middleware, calls AuditService |
| `server/services/systemd.service.js` | Wrap systemctl commands safely | `execFile()` with whitelist, 30s timeout |
| `server/services/log.service.js` | Stream journalctl output to WS clients | `spawn('journalctl', ['-f', '--output=json', '-u', name])` |
| `server/services/unitfile.service.js` | Read/write unit files in `/etc/systemd/system/` | `fs.readFile`/`fs.writeFile` + `daemon-reload` |
| `server/services/audit.service.js` | Persist audit records to SQLite | `better-sqlite3` prepared statements |
| `server/services/monitor.service.js` | Detect unexpected state changes | `setInterval` → `execFile systemctl show` → diff + emit |
| `server/utils/exec.js` | Safe command execution wrapper | `execFile` + timeout + input sanitization |
| `server/utils/sanitize.js` | Validate service names and parameters | Regex whitelist `/^[\w@\-.]+$/` |
| `server/db.js` | SQLite connection, WAL mode, migrations | `better-sqlite3` singleton + `journal_mode=WAL` |
| `src/hooks/useServices.js` | Poll service list every N seconds | `useEffect` + `setInterval` + `fetch /api/services` |
| `src/hooks/useWebSocket.js` | Manage WS lifecycle for log streaming | Custom hook: connect, reconnect, send JWT, parse messages |
| `src/hooks/useAuth.js` | Auth state, token refresh, logout | Zustand store + JWT decode + refresh call |

---

## Recommended Project Structure

```
systemdctl/
├── package.json                  # Both server + client deps, npm scripts
├── vite.config.js                # Frontend build config
├── tailwind.config.js
├── .env.example
│
├── server/
│   ├── index.js                  # http.createServer(app), WS attach, listen
│   ├── config.js                 # process.env parsing with defaults
│   ├── db.js                     # better-sqlite3 singleton, WAL, migrations
│   │
│   ├── middleware/
│   │   ├── auth.js               # JWT verify → req.user
│   │   ├── audit.js              # Post-action audit logging
│   │   └── rateLimit.js          # express-rate-limit for /api/auth/*
│   │
│   ├── routes/
│   │   ├── auth.routes.js        # POST /api/auth/login, /api/auth/refresh
│   │   ├── services.routes.js    # GET /api/services, POST action
│   │   ├── logs.routes.js        # GET /api/logs/:name (static), WS delegated
│   │   ├── units.routes.js       # CRUD /api/units/:name
│   │   ├── audit.routes.js       # GET /api/audit (paginated)
│   │   └── users.routes.js       # /api/users (admin only)
│   │
│   ├── services/
│   │   ├── systemd.service.js    # execFile systemctl, parse show output
│   │   ├── log.service.js        # spawn journalctl --follow, pipe to WS
│   │   ├── unitfile.service.js   # fs read/write + daemon-reload
│   │   ├── audit.service.js      # INSERT audit_log rows
│   │   └── monitor.service.js   # Background polling, EventEmitter
│   │
│   └── utils/
│       ├── exec.js               # Safe execFile wrapper with timeout
│       └── sanitize.js           # Input validation functions
│
├── src/
│   ├── main.jsx                  # ReactDOM.createRoot
│   ├── App.jsx                   # React Router v6, layout wrapper
│   ├── api.js                    # fetch/axios wrapper, JWT header injection
│   │
│   ├── components/
│   │   ├── Layout.jsx            # Sidebar + header shell
│   │   ├── ServiceList.jsx       # Table with sorting, filtering
│   │   ├── ServiceCard.jsx       # Single service row
│   │   ├── ServiceDetail.jsx     # Tabbed detail panel (Overview/Logs/Unit/Audit)
│   │   ├── LogViewer.jsx         # Virtualized scrolling log display
│   │   ├── UnitEditor.jsx        # CodeMirror with INI/systemd highlighting
│   │   ├── ActionBar.jsx         # Start/stop/restart/enable/disable
│   │   ├── StatusBadge.jsx       # Color-coded state indicator
│   │   ├── AuditLog.jsx          # Paginated audit table
│   │   ├── CreateServiceModal.jsx# Template wizard
│   │   ├── Toast.jsx             # Notification system
│   │   └── ConfirmDialog.jsx     # Destructive action guard
│   │
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Audit.jsx
│   │   └── Settings.jsx
│   │
│   ├── hooks/
│   │   ├── useServices.js        # Polling hook with visibility awareness
│   │   ├── useWebSocket.js       # WS connection + reconnect + auth
│   │   └── useAuth.js            # Auth state (Zustand) + token refresh
│   │
│   └── utils/
│       └── constants.js          # API base URL, polling interval, etc.
│
└── public/
    └── favicon.svg
```

### Structure Rationale

- **`server/services/`:** All systemd interactions are isolated here. Routes never call `execFile` directly — they always go through a service. This keeps the command-safety boundary clear and makes testing possible.
- **`server/utils/exec.js`:** Single choke point for all child process spawning. Enforces timeout, logs the command, and can be tested in isolation.
- **`server/routes/`:** Thin — validate input, check role, call service, return response. No business logic.
- **`src/hooks/`:** The three hooks are the data layer for the frontend. Components do not fetch directly — all data access goes through hooks.
- **`src/api.js`:** Single place JWT is attached to requests. Handles 401 → trigger refresh flow.

---

## Architectural Patterns

### Pattern 1: Safe Command Execution (execFile Wrapper)

**What:** All systemctl invocations go through a single `exec.js` wrapper that enforces array arguments, timeout, and logs execution. Never use `exec()` which spawns a shell.

**When to use:** Every systemctl call (start, stop, restart, enable, disable, show, daemon-reload).

**Trade-offs:** Slight overhead from validation, but eliminates shell injection attack surface entirely. The process is not running in a shell context so metacharacters in service names are inert.

**Example:**
```javascript
// server/utils/exec.js
const { execFile } = require('child_process');

const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart', 'enable', 'disable', 'show', 'daemon-reload', 'list-units', 'is-active']);
const SERVICE_NAME_RE = /^[\w@\-.]+$/;

async function safeExecFile(binary, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(binary, args, {
      timeout: options.timeout || 30000,
      maxBuffer: options.maxBuffer || 1024 * 1024 * 10, // 10MB
      encoding: 'utf8',
      // NEVER pass shell: true
    }, (err, stdout, stderr) => {
      if (err) {
        reject(Object.assign(err, { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function systemctl(action, serviceName) {
  if (!ALLOWED_ACTIONS.has(action)) {
    throw new Error(`Disallowed action: ${action}`);
  }
  if (serviceName && !SERVICE_NAME_RE.test(serviceName)) {
    throw new Error(`Invalid service name: ${serviceName}`);
  }
  const args = serviceName ? [action, serviceName] : [action];
  return safeExecFile('/usr/bin/systemctl', args);
}

module.exports = { safeExecFile, systemctl };
```

### Pattern 2: journalctl → WebSocket Streaming (spawn + pipe)

**What:** Use `spawn` (not `execFile`) for journalctl log streaming because spawn exposes `stdout` as a readable stream. Pipe each line to the WebSocket client. Tear down the child process when the WS closes.

**When to use:** The `/ws/logs/:name` WebSocket endpoint and the `GET /api/logs/:name` static fetch.

**Trade-offs:** spawn keeps a long-running process per log viewer open. On a machine with many simultaneous viewers this can be many journalctl processes. For a single-admin self-hosted tool this is acceptable. If multiple users watch the same service, fan-out from a single journalctl process would be an optimization — but defer this until needed.

**Example:**
```javascript
// server/services/log.service.js
const { spawn } = require('child_process');

function streamServiceLogs(serviceName, ws, options = {}) {
  const lines = String(Math.min(Math.max(parseInt(options.lines) || 50, 1), 1000));

  const child = spawn('/usr/bin/journalctl', [
    '--unit', serviceName,
    '--follow',
    '--output=json',
    '--lines', lines,
    '--no-pager',
  ]); // no shell: true — ever

  child.stdout.on('data', (chunk) => {
    // journalctl --output=json emits one JSON object per line
    const lines = chunk.toString().trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'log',
            message: entry.MESSAGE || '',
            timestamp: entry.__REALTIME_TIMESTAMP,
            priority: entry.PRIORITY,
          }));
        }
      } catch {
        // malformed line — skip
      }
    }
  });

  child.stderr.on('data', (data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message: data.toString() }));
    }
  });

  child.on('close', () => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'close' }));
    }
  });

  // Clean up when WS closes
  ws.on('close', () => {
    child.kill('SIGTERM');
  });

  return child;
}

module.exports = { streamServiceLogs };
```

### Pattern 3: WebSocket Server Attached to HTTP Server (noServer mode)

**What:** Create the `ws` WebSocketServer with `noServer: true` and handle JWT authentication in the HTTP server's `upgrade` event before handing off the connection. This is the only way to validate auth before the connection is accepted.

**When to use:** Always for the WS log streaming endpoint. The browser WebSocket API cannot send Authorization headers, so validate the JWT from the URL query parameter during the upgrade handshake.

**Trade-offs:** JWT in URL query string is logged by servers/proxies. Mitigate by using short-lived tokens (60s) dedicated for WS connections, or accept the risk in a self-hosted single-admin context. This is the standard pattern — the alternative (post-connect auth message) accepts the connection before auth and is harder to implement correctly.

**Example:**
```javascript
// server/index.js
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const { verifyToken } = require('./middleware/auth');

const app = express();
// ... middleware, routes setup

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (!url.pathname.startsWith('/ws/logs/')) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  const token = url.searchParams.get('token');
  const user = verifyToken(token); // synchronous JWT verify

  if (!user || !['admin', 'operator', 'viewer'].includes(user.role)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    const serviceName = url.pathname.replace('/ws/logs/', '');
    wss.emit('connection', ws, request, { user, serviceName });
  });
});

wss.on('connection', (ws, request, context) => {
  const { user, serviceName } = context;
  // Validate serviceName, start streaming
  streamServiceLogs(serviceName, ws);
});

server.listen(PORT, HOST);
```

### Pattern 4: SQLite Setup with WAL Mode

**What:** Open the better-sqlite3 connection as a module-level singleton. Enable WAL mode immediately. Use prepared statements for all queries. Wrap the migration in a single transaction.

**When to use:** `server/db.js`, called once on startup. All services receive this singleton.

**Trade-offs:** `better-sqlite3` is synchronous. This is intentional and actually better for this use case because it avoids async waterfall complexity and fits cleanly into Express route handlers. The database is never a bottleneck for an admin panel with < 10 concurrent users.

**Example:**
```javascript
// server/db.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/systemdctl.db');

const db = new Database(DB_PATH);

// Essential pragmas — run immediately after open
db.pragma('journal_mode = WAL');      // concurrent reads while writing
db.pragma('synchronous = NORMAL');    // safe with WAL, much faster than FULL
db.pragma('foreign_keys = ON');       // enforce referential integrity
db.pragma('cache_size = -32000');     // 32MB page cache

// Migrations in a single transaction
db.transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','operator','viewer')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      must_change_password BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER REFERENCES users(id),
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      service TEXT,
      details TEXT,
      ip_address TEXT,
      result TEXT NOT NULL DEFAULT 'success' CHECK(result IN ('success','failure')),
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watched_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      service_name TEXT NOT NULL,
      notify_on_change BOOLEAN DEFAULT 1,
      UNIQUE(user_id, service_name)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_service ON audit_log(service);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(username);
  `);
})();

module.exports = db;
```

### Pattern 5: React Polling with Visibility Awareness

**What:** Poll the service list on a configurable interval but pause when the browser tab is hidden. Use `document.visibilityState` to suppress unnecessary network calls.

**When to use:** `useServices` hook for the service dashboard. Never use a raw `setInterval` in a component — encapsulate it in a custom hook that handles cleanup.

**Trade-offs:** Polling is simpler to implement than Server-Sent Events or a full WebSocket feed for status. For a self-hosted single-admin tool, 10-second polling is adequate. The visibility optimization is worth the small complexity it adds.

**Example:**
```javascript
// src/hooks/useServices.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';

const POLL_INTERVAL = parseInt(import.meta.env.VITE_POLL_INTERVAL) || 10000;

export function useServices() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchServices = useCallback(async () => {
    try {
      const data = await api.get('/api/services');
      setServices(data.services);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices(); // initial fetch

    const startPolling = () => {
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchServices();
        }
      }, POLL_INTERVAL);
    };

    startPolling();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchServices(); // immediate refresh when tab regains focus
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchServices]);

  return { services, loading, error, refresh: fetchServices };
}
```

### Pattern 6: Express Serves Vite Build + SPA Fallback

**What:** In production, Express serves the Vite-built `dist/` directory as static files. A catch-all route sends `index.html` for any non-API, non-static path so React Router handles client-side navigation. In development, Vite dev server runs separately on a different port with proxy config.

**When to use:** Production deployment. Single npm build step, single process serves everything.

**Trade-offs:** Simplest possible deployment — one Node process, no separate static server needed. The ordering of middleware is critical: API routes before static, static before the SPA fallback.

**Example:**
```javascript
// server/index.js (production static serving block)
const path = require('path');
const DIST = path.join(__dirname, '../dist');

// 1. API routes (registered before static)
app.use('/api', apiRouter);

// 2. Static assets from Vite build
app.use(express.static(DIST, {
  maxAge: '1d',           // cache immutable hashed assets
  etag: true,
  index: false,           // do NOT auto-serve index.html — let the SPA fallback handle it
}));

// 3. SPA fallback — must be AFTER static and AFTER /api
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});
```

```javascript
// vite.config.js (development proxy)
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:7700',
      '/ws': { target: 'ws://localhost:7700', ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
};
```

---

## Data Flow

### HTTP Request Flow (Service Action)

```
Browser click "Restart nginx"
    |
    v
POST /api/services/nginx.service/action { action: "restart" }
    |
    v
helmet() → express-rate-limit → auth.js (JWT verify → req.user)
    |
    v  [403 if insufficient role]
services.routes.js
  - validate body.action is in whitelist
  - validate req.params.name matches /^[\w@\-.]+$/
    |
    v
SystemdService.executeAction('restart', 'nginx.service')
  - safeExecFile('/usr/bin/systemctl', ['restart', 'nginx.service'])
  - timeout: 30s
    |
    +--[error]→ HTTP 500 + audit.service.write(failure)
    |
    v [success]
AuditService.write({ user, action: 'restart', service: 'nginx.service', result: 'success' })
    |
    v
HTTP 200 { success: true, message: "nginx.service restarted" }
    |
    v
React: toast notification, trigger immediate poll refresh
```

### WebSocket Log Stream Flow

```
User opens Log tab for nginx.service
    |
    v
useWebSocket hook connects: new WebSocket('wss://panel.host/ws/logs/nginx.service?token=<jwt>')
    |
    v
server.on('upgrade') fires
  - parse serviceName from URL path
  - extract token from URL query
  - verifyToken(token) → user object or 401 + socket.destroy()
    |
    v [authenticated]
wss.handleUpgrade() → wss.emit('connection', ws, req, { user, serviceName })
    |
    v
LogService.streamServiceLogs('nginx.service', ws, { lines: 100 })
  - spawn journalctl ['--unit', 'nginx.service', '--follow', '--output=json', '--lines', '100', '--no-pager']
  - child.stdout.on('data') → parse JSON lines → ws.send(JSON.stringify({ type: 'log', ... }))
    |
    v
ws heartbeat ping every 30s: ws.send(JSON.stringify({ type: 'ping' }))
    |
    v
useWebSocket receives messages → append to log buffer → LogViewer re-renders
    |
    v [user closes tab or navigates away]
ws.close() → ws.on('close') fires → child.kill('SIGTERM')
```

### MonitorService State Change Flow

```
MonitorService.start() → setInterval(10s)
    |
    v
foreach watched service:
  execFile systemctl show --property=ActiveState,SubState <name>
    |
    v
compare current state vs previous state (in-memory Map)
    |
    +--[no change]→ skip
    |
    v [state changed]
emit 'stateChange' event: { service, from, to, timestamp }
    |
    v
WebSocket broadcast to all connected clients watching this service
    (future: notification hooks)
```

### Authentication Flow

```
POST /api/auth/login { username, password }
    |
    v
AuthService:
  - SELECT user WHERE username = ?  (prepared statement)
  - bcrypt.compare(password, hash)
    |
    +--[fail]→ increment rate limit counter → 401
    |
    v [success]
  - jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '1h' })  → accessToken
  - generate refreshToken (random 64 bytes) → store in DB or sign with longer secret
  - SET httpOnly cookie: refreshToken (7d)
    |
    v
{ token: accessToken }
    |
    v
React useAuth:
  - store accessToken in memory (NOT localStorage — XSS risk)
  - inject token in api.js as Authorization header
  - schedule refresh 5 min before expiry via setTimeout
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| systemd via systemctl | `execFile('/usr/bin/systemctl', [...])` — no shell | Runs as root. Input whitelist is the security boundary. |
| systemd via journalctl | `spawn('/usr/bin/journalctl', [...])` — no shell | Long-running process per WS client. Kill on WS close. |
| systemd unit files | `fs.readFile` / `fs.writeFile` on `/etc/systemd/system/*.service` | After write, run `systemctl daemon-reload`. Validate content is text. |
| NGINX / Caddy | Reverse proxy with WebSocket upgrade header passthrough | Requires `proxy_set_header Upgrade $http_upgrade; Connection "upgrade"` in NGINX. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Routes ↔ Services | Direct function call (same process) | Services are plain JS modules, not classes with DI |
| Services ↔ SQLite | `better-sqlite3` synchronous API | Single connection, WAL mode, prepared statements |
| Services ↔ systemd | Child process via `child_process` module | Isolated by OS process boundary |
| MonitorService ↔ WS clients | Node.js `EventEmitter` | MonitorService emits, WS handler subscribes |
| Frontend ↔ Backend (HTTP) | REST API + JWT in Authorization header | `api.js` centralizes this |
| Frontend ↔ Backend (WS) | WebSocket + JWT in URL query param | Only option since browsers can't set WS headers |

---

## Scaling Considerations

This is a self-hosted single-VPS admin panel. Scaling beyond one server is not a design goal. These are the realistic operational considerations:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-3 admins (target) | Current architecture is correct. No changes needed. SQLite handles this trivially. |
| 10+ concurrent users | Add journalctl fan-out: one spawn per service name, many WS subscribers. Reduces OS process count. |
| Multi-server management | Out of scope. Would require a fundamentally different architecture (agent per server). Defer entirely. |

### Scaling Priorities

1. **First bottleneck:** Too many simultaneous `journalctl` processes (one per log viewer). Fix: implement a LogBroadcaster that maintains one journalctl per service name and fans out to N WebSocket clients.
2. **Second bottleneck:** Monitor service polling frequency under many watched services. Fix: increase poll interval or batch `systemctl show` calls into one invocation with multiple unit names.

---

## Anti-Patterns

### Anti-Pattern 1: Using `exec()` or `shell: true` for systemctl

**What people do:** `exec('systemctl restart ' + serviceName)` for simplicity.

**Why it's wrong:** Spawns a shell (`/bin/sh -c`). A service name of `nginx.service; rm -rf /` becomes a shell command that executes. The project runs as root. This is a complete system compromise.

**Do this instead:** `execFile('/usr/bin/systemctl', ['restart', serviceName])` with the service name validated against `/^[\w@\-.]+$/` before calling.

### Anti-Pattern 2: Storing JWT Access Token in localStorage

**What people do:** `localStorage.setItem('token', accessToken)` for convenience across page refreshes.

**Why it's wrong:** Any JavaScript on the page (XSS) can read `localStorage`. Since the backend runs as root, a compromised token = root command execution.

**Do this instead:** Store the access token in memory (React state / Zustand store). Use an httpOnly cookie for the refresh token. On page refresh, call `/api/auth/refresh` to get a new access token. The token lives only in JS memory and is lost on page close.

### Anti-Pattern 3: Not Killing the journalctl Process on WS Close

**What people do:** Start `spawn journalctl --follow` and forget to clean up.

**Why it's wrong:** Every log view that doesn't clean up leaves a `journalctl` process running forever. On a busy server with a small number of admins this accumulates and wastes resources.

**Do this instead:** In the WS `close` event handler, call `child.kill('SIGTERM')`. Also handle `child.on('error')` to log unexpected process failures. Keep a reference to the child on the WS object so it can be killed regardless of how the WS is closed.

### Anti-Pattern 4: Accepting WebSocket Connections Before Authentication

**What people do:** Accept all WS connections, then send a message requesting credentials, close if auth fails.

**Why it's wrong:** The connection is open and consuming resources before auth. An attacker can exhaust connections before sending credentials. More complex to implement correctly — you need a timeout for the auth message, state for "authenticated vs not", etc.

**Do this instead:** Authenticate in the HTTP `upgrade` event handler before calling `wss.handleUpgrade()`. Send `HTTP/1.1 401 Unauthorized` and `socket.destroy()` for invalid tokens. The WS connection is never established for unauthenticated requests.

### Anti-Pattern 5: Placing the SPA Fallback Before Static Middleware

**What people do:** Register `app.get('*', sendIndexHtml)` before `express.static()`.

**Why it's wrong:** Every request — including `/main.js`, `/assets/index-abc123.js` — returns `index.html` instead of the actual asset. The SPA fails to load.

**Do this instead:** Register routes in this exact order: (1) API routes, (2) `express.static()`, (3) SPA fallback `app.get('*')`.

### Anti-Pattern 6: Using node-systemctl or Similar Thin Wrappers

**What people do:** Install `node-systemctl` npm package (last published 3 years ago, described as "hacky", zero dependents).

**Why it's wrong:** Unmaintained. Provides no real abstraction over calling systemctl directly. Adds a dependency to audit for security in a tool that runs as root.

**Do this instead:** Write a 50-line `exec.js` wrapper that calls `execFile` directly. It is smaller, safer, and you fully understand it. There is no meaningful npm ecosystem for systemd management in Node.js — build it yourself.

---

## Build Order (Dependencies Between Components)

The component graph has clear dependencies that dictate build order for the roadmap:

```
1. Project scaffolding (package.json, vite.config.js, .env.example)
        |
        v
2. server/db.js (SQLite connection + schema migration)
        |
        v
3. server/utils/exec.js + server/utils/sanitize.js (foundation for all services)
        |
        v
4. server/services/systemd.service.js (depends on exec.js)
        |
        v
5. server/middleware/auth.js + server/routes/auth.routes.js (depends on db.js)
        |
        v
6. server/routes/services.routes.js (depends on systemd.service + auth middleware)
        |
        v
7. server/index.js (wires everything: Express, WS server, static serving)
        |
        v
8. React scaffold: main.jsx, App.jsx, api.js, useAuth.js
        |
        v
9. React pages: Login, Dashboard (depends on api.js, auth)
        |
        v
10. React hooks: useServices (depends on Dashboard scaffolding)
        |
        v
11. server/services/log.service.js + WS handler (depends on exec.js, auth)
        |
        v
12. React hook: useWebSocket + LogViewer component
        |
        v
13. server/services/unitfile.service.js + units routes
        |
        v
14. React: UnitEditor component
        |
        v
15. server/services/audit.service.js + server/middleware/audit.js
        |
        v
16. React: AuditLog page
        |
        v
17. server/services/monitor.service.js (depends on systemd.service, WS broadcast)
        |
        v
18. Multi-user: roles enforcement, users routes, Settings page
```

**Phase implications:**
- Phase 1 (MVP): Steps 1-10. Delivers: login + service list + service actions.
- Phase 2 (Unit files): Steps 11-14. Delivers: log streaming + unit file editor.
- Phase 3 (Audit + Real-time): Steps 15-17. Delivers: audit log + state monitoring.
- Phase 4 (Multi-user): Step 18. Delivers: roles, user management.

---

## Sources

- [Node.js child_process official documentation](https://nodejs.org/api/child_process.html) — spawn vs execFile, streaming stdout, safety (HIGH confidence)
- [ws library GitHub — noServer pattern](https://github.com/websockets/ws) — HTTP upgrade handling, WS auth before accept (HIGH confidence)
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) — WAL mode, synchronous=NORMAL, prepared statements (HIGH confidence)
- [journalctl man page](https://www.freedesktop.org/software/systemd/man/latest/journalctl.html) — `--output=json`, `--follow`, `--lines` flags (HIGH confidence)
- [Auth0: Preventing Command Injection in Node.js](https://auth0.com/blog/preventing-command-injection-attacks-in-node-js-apps/) — execFile over exec, shell:true danger (HIGH confidence)
- [WebSocket Authentication 2025 — VideoSDK](https://www.videosdk.live/developer-hub/websocket/websocket-authentication) — JWT in URL query for WS (MEDIUM confidence, browser limitation is well-established)
- [React State Management 2025 — developerway.com](https://www.developerway.com/posts/react-state-management-2025) — Zustand for UI state, polling patterns (MEDIUM confidence)
- [Better-stack: Express WebSockets Guide](https://betterstack.com/community/guides/scaling-nodejs/express-websockets/) — Express + ws integration (MEDIUM confidence)
- node-systemctl npm: last published 3 years ago, zero dependents, described as "hacky" — do not use (HIGH confidence — confirmed on npm registry)

---

*Architecture research for: systemd admin panel (Node.js + Express + React + SQLite)*
*Researched: 2026-02-20*
