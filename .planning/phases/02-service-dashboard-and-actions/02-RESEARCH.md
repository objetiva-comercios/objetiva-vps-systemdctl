# Phase 2: Service Dashboard and Actions - Research

**Researched:** 2026-02-20
**Domain:** systemctl output parsing + Express REST API + React polling + Tailwind v4 dark UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | User can see all systemd services with their current status (active/inactive/failed) | `systemctl list-units --all --type=service --plain --no-legend` gives all 173 services; split on whitespace: field[0]=unit, [1]=load, [2]=active, [3]=sub, [4+]=description |
| DASH-02 | Each service shows load state, active state, sub-state, and enabled/disabled | list-units gives load/active/sub; `systemctl show -p UnitFileState` gives enabled/disabled; merge by service name on server |
| DASH-03 | Each service shows inline health metrics (PID, memory, CPU, uptime) | `systemctl show --type=service -p Id,MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp` for all loaded services in one call (369ms); parse blocks split by empty lines |
| DASH-07 | Dashboard shows system hostname and uptime | Node.js `os.hostname()` + `os.uptime()` — no external dependencies; expose via `GET /api/system` |
| ACTN-01 | User can start a stopped service | `runSystemctl('start', serviceName)` — already whitelisted in exec.js |
| ACTN-02 | User can stop a running service | `runSystemctl('stop', serviceName)` — already whitelisted in exec.js |
| ACTN-03 | User can restart a service | `runSystemctl('restart', serviceName)` — already whitelisted in exec.js |
| ACTN-04 | User can enable a service to start at boot | `runSystemctl('enable', serviceName)` — already whitelisted in exec.js |
| ACTN-05 | User can disable a service from starting at boot | `runSystemctl('disable', serviceName)` — already whitelisted in exec.js |
| INFR-05 | Auto-polling of service status every 10 seconds | `useEffect` + `setInterval` with `clearInterval` on cleanup; no external library needed |
</phase_requirements>

---

## Summary

Phase 2 is straightforward to implement given the security foundation Phase 1 established. The exec wrapper (`server/utils/exec.js`) already whitelists all five actions (start, stop, restart, enable, disable) and the list/show actions needed for the dashboard. No new npm dependencies are required for any Phase 2 feature — the entire server side uses only Node.js built-ins (`os`, `child_process`) plus the existing Express/better-sqlite3 stack.

The most important implementation decision is how to populate service health metrics (DASH-03). `systemctl show --type=service -p Id,...` retrieves data for all loaded services in a single call (verified: 369ms on this machine, returning data for 60 loaded services). `systemctl list-units --all --type=service --plain --no-legend` retrieves all 173 services (including 21 not-found units) in ~10ms. The recommended pattern is to run both calls in parallel, parse each output, and merge on the server by service name — all within a single `GET /api/services` endpoint that the client polls every 10 seconds.

For the frontend, React 19's native `useEffect` + `setInterval` pattern is the correct fit. TanStack Query is not installed and would be overkill for this use case. The existing Tailwind v4 custom colors (`--color-accent`, `--color-danger`, `--color-warning`, `--color-text-muted`) map cleanly to service state indicators. The existing lucide-react 0.575.0 package includes all needed icons: `Play`, `CircleStop`, `RefreshCw`, `Power`, `PowerOff`, `Cpu`, `MemoryStick`, `Timer`, `LoaderCircle`.

**Primary recommendation:** Build two Express routes (`GET /api/services` + `POST /api/services/:name/action`), one system route (`GET /api/system`), one React page (`ServiceDashboard`), and one polling hook (`useServicePolling`). No new npm packages needed.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^5.2.1 | REST API routes | Already in project |
| react | ^19.2.0 | Dashboard UI | Already in project |
| better-sqlite3 | ^12.6.2 | (not used in Phase 2) | Available if needed |
| lucide-react | ^0.575.0 | Icons for status/actions | Already in project |
| tailwindcss | ^4.2.0 | Styling with custom colors | Already in project |

### Node.js Built-ins (no install needed)
| Module | Purpose | Usage |
|--------|---------|-------|
| `node:os` | `os.hostname()`, `os.uptime()` | System info for DASH-07 |
| `node:child_process` | Already wrapped in exec.js | systemctl invocations |

### NOT needed (do not add)
- TanStack Query — useEffect + setInterval is sufficient for 10s polling
- axios — native `fetch` works in React 19 + modern Node
- any systemd npm library — direct systemctl via exec wrapper is correct

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Structure (additions to Phase 1)
```
server/
├── routes/
│   ├── services.js      # GET /api/services, POST /api/services/:name/action
│   └── system.js        # GET /api/system
├── utils/
│   ├── exec.js          # EXISTING - no changes
│   └── systemctl.js     # NEW - parsing helpers for show/list-units output
└── index.js             # EXISTING - mount new routers

src/
├── components/
│   ├── Layout.tsx        # EXISTING - no changes
│   ├── ServiceTable.tsx  # NEW - table of all services
│   ├── ServiceRow.tsx    # NEW - single service row with actions
│   └── SystemHeader.tsx  # NEW - hostname + uptime bar
├── hooks/
│   └── useServicePolling.ts  # NEW - 10-second polling hook
├── pages/
│   └── Home.tsx          # REPLACE placeholder with ServiceDashboard
└── types/
    └── service.ts        # NEW - TypeScript types for API responses
```

### Pattern 1: Two-Call Merge for Service List (GET /api/services)

**What:** Run `list-units` and `show` in parallel, merge results by service name on the server.
**When to use:** Every time GET /api/services is called (polled every 10s).

```javascript
// server/utils/systemctl.js
import { runSystemctl } from './exec.js'

/**
 * Parse `systemctl list-units --plain --no-legend` output.
 * Returns array of { unit, load, active, sub, description }.
 */
export function parseListUnits(stdout) {
  return stdout
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        unit: parts[0],
        load: parts[1],
        active: parts[2],
        sub: parts[3],
        description: parts.slice(4).join(' '),
      }
    })
}

/**
 * Parse `systemctl show -p Id,...` output.
 * Blocks are separated by blank lines; each block is key=value lines.
 * Returns Map<id, properties>.
 */
export function parseShowOutput(stdout) {
  const map = new Map()
  const blocks = stdout.trim().split('\n\n')
  for (const block of blocks) {
    const props = {}
    for (const line of block.split('\n')) {
      const idx = line.indexOf('=')
      if (idx > 0) props[line.slice(0, idx)] = line.slice(idx + 1)
    }
    if (props.Id) map.set(props.Id, props)
  }
  return map
}

/**
 * Fetch all services with merged basic + detail data.
 * Runs list-units and show in parallel.
 */
export async function getAllServices() {
  const SHOW_PROPS = 'Id,Description,MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp,ActiveState,LoadState,SubState,UnitFileState'

  const [listResult, showResult] = await Promise.all([
    runSystemctl('list-units', null, ['--all', '--type=service', '--plain', '--no-legend']),
    runSystemctl('show', null, ['--type=service', '-p', SHOW_PROPS]),
  ])

  const basicList = parseListUnits(listResult.stdout)
  const detailMap = parseShowOutput(showResult.stdout)

  return basicList.map(svc => {
    const detail = detailMap.get(svc.unit) ?? {}
    return {
      unit: svc.unit,
      load: detail.LoadState ?? svc.load,
      active: detail.ActiveState ?? svc.active,
      sub: detail.SubState ?? svc.sub,
      description: detail.Description ?? svc.description,
      unitFileState: detail.UnitFileState ?? '',
      pid: detail.MainPID && detail.MainPID !== '0' ? parseInt(detail.MainPID) : null,
      memoryBytes: detail.MemoryCurrent && detail.MemoryCurrent !== '[not set]'
        ? parseInt(detail.MemoryCurrent) : null,
      cpuNsec: detail.CPUUsageNSec && detail.CPUUsageNSec !== '[not set]'
        ? parseInt(detail.CPUUsageNSec) : null,
      activeEnterTimestamp: detail.ActiveEnterTimestamp || null,
    }
  })
}
```

### Pattern 2: Action Endpoint with State Refresh

**What:** POST action, then re-fetch updated service state and return it.
**When to use:** All ACTN-01 through ACTN-05.

```javascript
// server/routes/services.js
import express from 'express'
import { runSystemctl } from '../utils/exec.js'
import { getAllServices, parseShowOutput } from '../utils/systemctl.js'

const router = express.Router()
const SHOW_PROPS = 'Id,Description,MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp,ActiveState,LoadState,SubState,UnitFileState'
const ALLOWED_DASHBOARD_ACTIONS = ['start', 'stop', 'restart', 'enable', 'disable']

router.get('/', async (req, res, next) => {
  try {
    const services = await getAllServices()
    res.json({ ok: true, services })
  } catch (err) {
    next(err)
  }
})

router.post('/:name/action', async (req, res, next) => {
  try {
    const { name } = req.params
    const { action } = req.body

    if (!ALLOWED_DASHBOARD_ACTIONS.includes(action)) {
      return res.status(400).json({ ok: false, error: `Invalid action: ${action}` })
    }

    // Run the action
    const result = await runSystemctl(action, name)

    // Re-fetch updated state for this service
    const showResult = await runSystemctl('show', name, ['-p', SHOW_PROPS])
    const detailMap = parseShowOutput(showResult.stdout)
    const detail = detailMap.get(name) ?? {}

    res.json({
      ok: result.ok,
      stderr: result.stderr || undefined,
      service: {
        unit: name,
        load: detail.LoadState ?? '',
        active: detail.ActiveState ?? '',
        sub: detail.SubState ?? '',
        description: detail.Description ?? '',
        unitFileState: detail.UnitFileState ?? '',
        pid: detail.MainPID && detail.MainPID !== '0' ? parseInt(detail.MainPID) : null,
        memoryBytes: detail.MemoryCurrent && detail.MemoryCurrent !== '[not set]'
          ? parseInt(detail.MemoryCurrent) : null,
        cpuNsec: detail.CPUUsageNSec && detail.CPUUsageNSec !== '[not set]'
          ? parseInt(detail.CPUUsageNSec) : null,
        activeEnterTimestamp: detail.ActiveEnterTimestamp || null,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
```

### Pattern 3: System Info Endpoint (DASH-07)

```javascript
// server/routes/system.js
import express from 'express'
import os from 'node:os'

const router = express.Router()

router.get('/', (req, res) => {
  res.json({
    ok: true,
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(os.uptime()),
  })
})

export default router
```

### Pattern 4: Mount Routers in index.js

```javascript
// Addition to server/index.js
import servicesRouter from './routes/services.js'
import systemRouter from './routes/system.js'

app.use('/api/services', servicesRouter)
app.use('/api/system', systemRouter)
```

### Pattern 5: 10-Second Polling Hook (INFR-05)

```typescript
// src/hooks/useServicePolling.ts
import { useState, useEffect, useCallback } from 'react'
import type { ServiceEntry } from '../types/service'

export function useServicePolling(intervalMs = 10_000) {
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      if (data.ok) {
        setServices(data.services)
        setLastUpdated(new Date())
        setError(null)
      } else {
        setError(data.error ?? 'Failed to fetch services')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchServices() // immediate first fetch
    const id = setInterval(fetchServices, intervalMs)
    return () => clearInterval(id) // cleanup on unmount
  }, [fetchServices, intervalMs])

  return { services, loading, error, lastUpdated, refresh: fetchServices }
}
```

### Pattern 6: Service Action from React

```typescript
// Usage in ServiceRow.tsx
async function handleAction(action: string) {
  setActionPending(action)
  try {
    const res = await fetch(`/api/services/${encodeURIComponent(service.unit)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (data.ok && data.service) {
      onServiceUpdate(data.service) // update row in parent state
    } else {
      setActionError(data.stderr ?? data.error ?? 'Action failed')
    }
  } finally {
    setActionPending(null)
  }
}
```

### Pattern 7: Formatting Helpers

```typescript
// Bytes -> human readable
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

// Nanoseconds -> human readable cumulative CPU time
export function formatCpuTime(nsec: number | null): string {
  if (nsec === null) return '—'
  const ms = nsec / 1_000_000
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  return `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`
}

// ActiveEnterTimestamp -> uptime string
export function formatUptime(timestamp: string | null): string {
  if (!timestamp) return '—'
  // Format: "Day YYYY-MM-DD HH:MM:SS TZ" -> strip day-of-week
  const parts = timestamp.split(' ')
  const dateStr = parts.slice(1).join(' ') // "YYYY-MM-DD HH:MM:SS TZ"
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`
}

// System uptime from os.uptime() seconds
export function formatSystemUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
```

### Anti-Patterns to Avoid

- **Separate `systemctl is-enabled` call per service:** Use `UnitFileState` from `systemctl show` instead — one batch call vs 173 individual calls.
- **Parsing `systemctl status` (human output):** Use `systemctl show -p Key=Value` format instead — machine-readable, stable across locales.
- **setInterval without cleanup:** Always `clearInterval` in the `useEffect` return function or the interval survives component unmount.
- **Blocking: awaiting list-units THEN show sequentially:** Use `Promise.all([...])` to run both in parallel — cuts ~180ms off each request.
- **Using `exec()` or `shell: true`:** The existing exec.js wrapper handles this. Never bypass it.
- **Storing service state in SQLite:** The service list is live systemd state — always fetch fresh, never cache in DB.
- **Polling from multiple components:** One top-level polling hook in the dashboard page, pass data down as props.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Human-readable bytes | Custom formatter | `formatBytes()` utility function | Trivial to write once; don't spread formatting logic across components |
| CPU percentage | Diff two CPUUsageNSec samples | Display cumulative CPU time | Percentage requires two timed samples; not required by DASH-03 spec |
| Uptime from timestamp | Complex date math | `formatUptime()` stripping day prefix + `Date` constructor | Verified working: `new Date("YYYY-MM-DD HH:MM:SS UTC")` parses correctly |
| Service-list JSON output | Parse non-standard formats | `split('\n\n')` on show output | systemctl show -p uses stable `key=value` format per official docs |
| Auto-refresh library | TanStack Query / SWR | Native `useEffect` + `setInterval` | No dependency needed for simple 10s polling of one endpoint |
| Spinner/loading state | CSS animations | `LoaderCircle` from lucide-react with `animate-spin` Tailwind class | Already installed |

**Key insight:** systemctl's `show -p` format is explicitly designed for machine parsing (key=value, blocks split by blank lines). Use it rather than parsing the human-readable `status` output.

---

## Common Pitfalls

### Pitfall 1: MemoryCurrent and CPUUsageNSec Return `[not set]` for Inactive Services
**What goes wrong:** Parsing `parseInt('[not set]')` returns `NaN`, breaking JSON responses or UI display.
**Why it happens:** systemd only tracks memory for running services. Inactive, exited, and not-found services return `[not set]`.
**How to avoid:** Guard in parsing: `value !== '[not set]' ? parseInt(value) : null`. Return `null` from API, display `"—"` in UI.
**Warning signs:** NaN appearing in API responses or UI showing "NaN MB".

### Pitfall 2: ActiveEnterTimestamp Empty for Never-Started Services
**What goes wrong:** `new Date('')` or `new Date(undefined)` returns an invalid Date object; computing uptime gives NaN.
**Why it happens:** Services that are inactive and have never run have no enter timestamp.
**How to avoid:** Check `!timestamp || timestamp.trim() === ''` before parsing; return `null`, display `"—"` in UI.
**Warning signs:** "Invalid Date" or "NaN" appearing in uptime column.

### Pitfall 3: list-units Description Field Contains Spaces
**What goes wrong:** `line.split(' ')` gives incorrect field count; description gets split across multiple elements.
**Why it happens:** The description can be multiple words; the output is space-padded, not tab-separated.
**How to avoid:** Split on `\s+` (not `' '`) and use `parts.slice(4).join(' ')` for the description. Verified working on this machine.
**Warning signs:** Service descriptions showing as single words or getting truncated.

### Pitfall 4: show --type=service Returns Fewer Services than list-units --all
**What goes wrong:** Dashboard only shows ~60 services instead of all 173.
**Why it happens:** `show --type=service` only returns currently-loaded units; `list-units --all` includes not-found/unloaded units.
**How to avoid:** Always use `list-units --all` as the source-of-truth for the service list. Merge show data where available; leave metrics as `null` for not-found services.
**Warning signs:** Dashboard missing services that `systemctl list-units --all` shows.

### Pitfall 5: setInterval Firing During Pending Fetch
**What goes wrong:** 10-second interval fires while previous fetch is still pending; concurrent fetches cause race conditions or stale state overwrites.
**Why it happens:** No guard prevents overlapping fetch calls if the server is slow.
**How to avoid:** Track `isFetching` ref to skip interval tick if previous fetch is pending:
```typescript
const isFetching = useRef(false)
const fetchServices = async () => {
  if (isFetching.current) return
  isFetching.current = true
  try { /* fetch */ } finally { isFetching.current = false }
}
```
**Warning signs:** Duplicate requests visible in browser DevTools Network tab.

### Pitfall 6: Action Button Double-Click Sends Two Commands
**What goes wrong:** Admin clicks "Stop" twice quickly, causing two stop commands (second returns error); UI shows error state incorrectly.
**Why it happens:** No loading/pending state on the action button.
**How to avoid:** Disable all action buttons on a service row while any action is pending for that service. Track `actionPending: string | null` per row.
**Warning signs:** Two identical POST requests visible in DevTools for one click.

### Pitfall 7: CPUUsageNSec is Cumulative, Not Instantaneous Percentage
**What goes wrong:** Displaying "564621971000 ns" or converting it as a percentage produces meaningless numbers.
**Why it happens:** CPUUsageNSec is total CPU time consumed since service start — not a rate.
**How to avoid:** Display as formatted cumulative time (e.g., "564s CPU") using `formatCpuTime()`. Label the column "CPU time" not "CPU %".
**Warning signs:** Values like "56400%" appearing in CPU column.

---

## Code Examples

Verified patterns from direct testing on this machine:

### systemctl show Batch Command (confirmed working)
```bash
# Fetches all loaded services in one call (~369ms, 60 services on this machine)
systemctl --no-pager show --type=service \
  -p Id,Description,MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp,ActiveState,LoadState,SubState,UnitFileState
```

### list-units Command (confirmed working, ~10ms)
```bash
systemctl --no-pager list-units --all --type=service --plain --no-legend
# Output format (space-padded, NOT tabs):
# apparmor.service    loaded    active   exited  Load AppArmor profiles
# Fields: [0]=unit [1]=load [2]=active [3]=sub [4+]=description
```

### Confirmed Property Values (from live system)
```
# Running service (containerd.service):
MainPID=83092
MemoryCurrent=479301632        # bytes as integer string
CPUUsageNSec=564621971000      # nanoseconds as integer string
ActiveState=active
SubState=running
UnitFileState=enabled
ActiveEnterTimestamp=Thu 2026-02-19 11:49:34 UTC

# Inactive service (apt-daily.service):
MainPID=0
MemoryCurrent=[not set]        # always "[not set]" when inactive
CPUUsageNSec=16597158000       # preserved even when inactive
ActiveState=inactive
SubState=dead
UnitFileState=static
ActiveEnterTimestamp=           # empty string when never entered active

# Not-found service (auditd.service):
LoadState=not-found
ActiveState=inactive
UnitFileState=                 # empty string
```

### Timestamp Parsing (confirmed in Node.js)
```javascript
// ActiveEnterTimestamp format: "Thu 2026-02-19 11:49:34 UTC"
const parts = timestamp.split(' ')         // ["Thu", "2026-02-19", "11:49:34", "UTC"]
const dateStr = parts.slice(1).join(' ')   // "2026-02-19 11:49:34 UTC"
const d = new Date(dateStr)                // valid Date object (confirmed)
```

### Available lucide-react Icons for This Phase (confirmed in 0.575.0)
```typescript
import {
  Play,           // start action
  CircleStop,     // stop action
  RefreshCw,      // restart action
  Power,          // enable action
  PowerOff,       // disable action
  Cpu,            // CPU metric column header
  MemoryStick,    // memory metric column header
  Timer,          // uptime metric column header
  LoaderCircle,   // spinner while action pending (use with animate-spin)
  CircleAlert,    // failed service status indicator
  CircleCheck,    // active service status indicator
  CircleDot,      // inactive service status indicator
} from 'lucide-react'
```

### Tailwind v4 Status Color Classes (using existing CSS variables)
```tsx
// Active service: green
<span className="text-accent">active</span>

// Failed service: red
<span className="text-danger">failed</span>

// Inactive service: muted
<span className="text-text-muted">inactive</span>

// Warning/exited: amber
<span className="text-warning">exited</span>

// Enabled badge: green outline
<span className="border border-accent text-accent text-xs px-1">enabled</span>

// Disabled badge: muted outline
<span className="border border-border text-text-muted text-xs px-1">disabled</span>
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Parse `systemctl status` human output | Use `systemctl show -p key1,key2` key=value output | Locale-independent, stable, machine-readable |
| Poll each service individually | `systemctl show --type=service` batch call | One call for all services vs N calls |
| WebSocket for live updates | HTTP polling every 10s | Simpler; sufficient for 10s refresh interval |
| setInterval directly in component | `useEffect` + `setInterval` with cleanup | Avoids memory leaks on unmount |
| TanStack Query for data fetching | Native `useEffect` + `fetch` | No dependency for simple polling case |

**Deprecated/outdated:**
- `StopCircle` from older lucide-react: Use `CircleStop` (confirmed exported in 0.575.0)
- `systemctl list-units --output=json`: JSON output not supported for list-units per official docs; use `--plain --no-legend` + space split instead

---

## Open Questions

1. **Should not-found services appear in the dashboard?**
   - What we know: `list-units --all` returns 21 not-found services (e.g., `auditd.service`); they have no actionable metrics; the requirement says "all services visible to list-units --all"
   - What's unclear: Whether showing not-found services adds confusion or value for the admin
   - Recommendation: Include them (per requirement wording) but display with a `not-found` badge and greyed-out action buttons since starting/stopping a not-found service will fail

2. **CPUUsageNSec display label**
   - What we know: It is cumulative CPU time, not percentage
   - What's unclear: Whether "CPU time" label is intuitive enough for admins
   - Recommendation: Label column "CPU" and display formatted value like "564s" with no percent sign; tooltip on hover can explain "total CPU time since start"

3. **Action endpoint response when enable/disable is called**
   - What we know: `enable` and `disable` change `UnitFileState` but not `ActiveState`; a re-fetch of `show -p` after enable still returns the service correctly
   - What's unclear: Whether the response should include the full service object or just `ok: true`
   - Recommendation: Always return the updated service object from the action endpoint for consistency (Pattern 2 above)

---

## Sources

### Primary (HIGH confidence)
- Direct `systemctl` execution on target machine (Ubuntu 22.04, systemd 255.4-1ubuntu8.12) — all property names, output formats, and timing verified live
- Node.js v22.22.0 `os` module — `os.hostname()` and `os.uptime()` verified working
- `/home/sanchez/proyectos/systemdctl/server/utils/exec.js` — ALLOWED_ACTIONS whitelist confirmed (list-units, show, start, stop, restart, enable, disable all present)
- `/home/sanchez/proyectos/systemdctl/node_modules/lucide-react/dist/lucide-react.d.ts` — icon names confirmed (Play, CircleStop, RefreshCw, Power, PowerOff, Cpu, MemoryStick, Timer, LoaderCircle, CircleAlert, CircleCheck)

### Secondary (MEDIUM confidence)
- https://www.freedesktop.org/software/systemd/man/latest/systemctl.html — official systemctl docs confirming `show -p` property names and `list-units` column structure
- https://overreacted.io/making-setinterval-declarative-with-react-hooks/ — Dan Abramov's canonical useInterval pattern (the useRef+useEffect approach)
- https://nodejs.org/api/os.html — Node.js os module official documentation

### Tertiary (LOW confidence — not needed, cross-verified above)
- Various WebSearch results on polling patterns — superseded by direct implementation verification

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against actual installed packages and live systemctl calls
- Architecture: HIGH — patterns verified by direct execution on target machine
- systemctl output format: HIGH — directly tested, not assumed
- Pitfalls: HIGH — discovered through live testing (MemoryCurrent=[not set], empty timestamps, etc.)
- React polling: HIGH — standard useEffect/setInterval pattern, no exotic dependencies

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days; systemctl output format is stable across minor systemd updates)
