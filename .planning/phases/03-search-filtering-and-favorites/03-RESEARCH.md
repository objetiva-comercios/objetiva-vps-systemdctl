# Phase 3: Search, Filtering, and Favorites - Research

**Researched:** 2026-02-21
**Domain:** Client-side filtering (React/useMemo) + SQLite persistence (better-sqlite3) + REST API (Express 5)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-04 | User can search services by name | Client-side `useMemo` filter on `service.unit` with case-insensitive substring match; no API call on keystroke; confirmed < 0.05ms for 173 services |
| DASH-05 | User can filter services by status (running, stopped, failed) | Client-side `useMemo` filter using `service.sub === 'running'` / `service.active === 'inactive'` / `service.active === 'failed'`; confirmed against live system with 24 running, 113 stopped, 0 failed, 36 other (exited) |
| DASH-06 | User can mark services as watched/favorite for quick access, persists across reloads | `watched_services` SQLite table (TEXT PRIMARY KEY, no user_id since no auth in v1); `POST /api/watched/:name` + `DELETE /api/watched/:name`; `isWatched: boolean` merged into `/api/services` response server-side; watched section rendered above main list in Home page |
</phase_requirements>

---

## Summary

Phase 3 adds three related features to the existing Home page: real-time name search, status-based filtering, and a persistent "watched" (favorite) toggle per service. All three are implemented entirely in the existing stack — no new npm packages are required.

Search and status filtering are pure client-side operations. With 173 services, a `useMemo` filter takes under 0.05ms per re-render — no debouncing, no `useDeferredValue`, and no server-side query parameters are needed. Two pieces of state (`searchQuery: string` and `statusFilter: string`) drive a single derived `filteredServices` array via `useMemo`. The existing `services` array from `useServicePolling` is the source of truth; filtering never mutates it.

Watched/favorites requires a small backend addition. A new `watched_services` table in the existing SQLite database stores `unit TEXT PRIMARY KEY`. The table is created in `server/db.js` via `CREATE TABLE IF NOT EXISTS` (idempotent, runs on import). Two new Express routes handle toggle operations (`POST /api/watched/:name` and `DELETE /api/watched/:name`). The `GET /api/services` response is extended to include `isWatched: boolean` per service, merged server-side from the watch set before the response is sent — no extra client round-trip. The watched section renders above the main filtered table when any services are watched.

**Primary recommendation:** Add filter/search state to `Home.tsx`, a `watched_services` table to `db.js`, two new Express routes in a new `server/routes/watched.js` file, and extend `getAllServices()` to accept and merge a watched set. No new packages needed.

---

## Standard Stack

### Core (already installed — no additions needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.0 | `useMemo` for derived filtered list | Already in project |
| better-sqlite3 | ^12.6.2 | Synchronous SQLite for watched_services table | Already in project; WAL mode confirmed active |
| express | ^5.2.1 | Two new REST routes for watch toggle | Already in project |
| lucide-react | ^0.575.0 | `Star`, `StarOff`, `Search`, `X` icons (all confirmed exported) | Already in project |
| tailwindcss | ^4.2.0 | Filter button group styling, search input styling | Already in project |

### NOT needed (do not add)
- Fuse.js or similar fuzzy search library — substring match on 173 items needs no library
- TanStack Query — existing polling hook is sufficient; no new data source to manage
- Zod or validation library — unit name regex validation is one line
- Debounce utility — filtering 173 items is < 0.05ms, no debounce needed
- localStorage — SQLite is the persistence layer; localStorage would create sync issues across tabs and server restarts

**Installation:** No new packages required.

---

## Architecture Patterns

### File Changes Summary
```
server/
├── db.js                          # MODIFY: add CREATE TABLE IF NOT EXISTS watched_services
├── routes/
│   ├── services.js                # MODIFY: import db, merge isWatched into getAllServices response
│   └── watched.js                 # NEW: POST /api/watched/:name, DELETE /api/watched/:name
├── index.js                       # MODIFY: mount watchedRouter at /api/watched
└── utils/
    └── systemctl.js               # MODIFY: getAllServices() accepts watchedSet param

src/
├── types/
│   └── service.ts                 # MODIFY: add isWatched: boolean to ServiceEntry
├── pages/
│   └── Home.tsx                   # MODIFY: add searchQuery, statusFilter state; useMemo; WatchedSection
└── components/
    ├── ServiceTable.tsx            # MODIFY: accept onToggleWatch prop, pass to rows
    ├── ServiceRow.tsx              # MODIFY: add Star/StarOff toggle button; accept onToggleWatch
    └── SearchFilterBar.tsx        # NEW: search input + status filter buttons
```

### Pattern 1: Client-Side Filter with useMemo

**What:** Derive `filteredServices` from the polled `services` array using two state variables.
**When to use:** Any time `searchQuery`, `statusFilter`, or `services` changes.

```typescript
// src/pages/Home.tsx
import { useMemo, useState } from 'react'

const [searchQuery, setSearchQuery] = useState('')
const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'failed'>('all')

const filteredServices = useMemo(() => {
  let result = services

  // Name search: case-insensitive substring on unit name
  if (searchQuery.trim()) {
    const lower = searchQuery.toLowerCase()
    result = result.filter(s => s.unit.toLowerCase().includes(lower))
  }

  // Status filter
  if (statusFilter !== 'all') {
    result = result.filter(s => {
      if (statusFilter === 'running') return s.sub === 'running'
      if (statusFilter === 'stopped') return s.active === 'inactive'
      if (statusFilter === 'failed') return s.active === 'failed'
      return true
    })
  }

  return result
}, [services, searchQuery, statusFilter])

// Separate watched section (always shows all watched, regardless of filter)
const watchedServices = useMemo(
  () => services.filter(s => s.isWatched),
  [services]
)
```

**Verified:** 173 services, dual-filter pass in < 0.05ms. No debounce needed.

### Pattern 2: Status Filter Field Mapping

**What:** Map user-visible filter labels to ServiceEntry field values.

```
Live system breakdown (173 services on this machine):
  24x active=active, sub=running     → "running" filter: s.sub === 'running'
 113x active=inactive, sub=dead      → "stopped" filter: s.active === 'inactive'
   0x active=failed, sub=failed      → "failed"  filter: s.active === 'failed'
  36x active=active, sub=exited      → "all" only (exited one-shot services)
```

**Key insight:** Filter by `s.sub === 'running'` (not `s.active === 'active'`) for "running" to exclude exited one-shot services. This correctly separates "nginx is running" from "apparmor ran and exited."

### Pattern 3: SQLite watched_services Table

**What:** Minimal schema, no user_id (no auth in v1). Unit name is the primary key.
**When to use:** Added to `db.js` so it is created on first server start.

```javascript
// server/db.js — add after existing pragma lines
db.exec(`
  CREATE TABLE IF NOT EXISTS watched_services (
    unit TEXT PRIMARY KEY NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)
```

**Verified:** `CREATE TABLE IF NOT EXISTS` is idempotent. SQLite version is 3.51.2 — `unixepoch()` is supported (added in 3.38.0).

### Pattern 4: Watched REST Routes

**What:** Two endpoints for toggling watch state. No systemctl involved — only SQLite reads/writes.
**When to use:** Client calls these on Star button click; optimistic UI update follows.

```javascript
// server/routes/watched.js
import express from 'express'
import db from '../db.js'

const router = express.Router()

// Validate unit names for watched route (wider than SERVICE_NAME_RE because
// backslash-escaped units like systemd-fsck@dev-disk-by\x2dlabel-BOOT.service
// are valid watch targets but cannot be passed to systemctl)
// Chars found in live unit names: a-z A-Z 0-9 . - _ @ \ :
const UNIT_NAME_RE = /^[\w@\-.:\/\\]+\.service$/

const stmts = {
  add:    db.prepare('INSERT OR IGNORE INTO watched_services (unit) VALUES (?)'),
  remove: db.prepare('DELETE FROM watched_services WHERE unit = ?'),
  check:  db.prepare('SELECT 1 FROM watched_services WHERE unit = ?'),
}

router.post('/:name', (req, res) => {
  const { name } = req.params
  if (!UNIT_NAME_RE.test(name)) {
    return res.status(400).json({ ok: false, error: 'Invalid unit name' })
  }
  stmts.add.run(name)
  res.json({ ok: true, unit: name, isWatched: true })
})

router.delete('/:name', (req, res) => {
  const { name } = req.params
  if (!UNIT_NAME_RE.test(name)) {
    return res.status(400).json({ ok: false, error: 'Invalid unit name' })
  }
  stmts.remove.run(name)
  res.json({ ok: true, unit: name, isWatched: false })
})

export default router
```

**Note on validation:** The existing `SERVICE_NAME_RE = /^[\w@\-.]+$/` in exec.js rejects backslash (`\`). The watched route does NOT call systemctl, so it uses a wider regex. Confirmed live: `systemd-fsck@dev-disk-by\x2dlabel-BOOT.service` has backslash and is a valid watch target.

### Pattern 5: Merging isWatched into GET /api/services

**What:** Server fetches watch set from SQLite and merges `isWatched: boolean` into each service object before responding.
**When to use:** Every time `GET /api/services` is called (polled every 10s).

```javascript
// server/utils/systemctl.js — extend getAllServices()
import db from '../db.js'

export async function getAllServices() {
  // Fetch watch set (synchronous SQLite call — negligible overhead)
  const watchedSet = new Set(
    db.prepare('SELECT unit FROM watched_services').all().map(r => r.unit)
  )

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
      isWatched: watchedSet.has(svc.unit),  // NEW field
    }
  })
}
```

### Pattern 6: Optimistic Watch Toggle in Client

**What:** Update local state immediately on Star click, then persist to server. Revert on failure.
**When to use:** All watch toggle operations.

```typescript
// src/pages/Home.tsx
async function handleToggleWatch(unit: string, currentlyWatched: boolean) {
  // Optimistic update
  setServices(prev =>
    prev.map(s => s.unit === unit ? { ...s, isWatched: !currentlyWatched } : s)
  )

  try {
    const method = currentlyWatched ? 'DELETE' : 'POST'
    const res = await fetch(`/api/watched/${encodeURIComponent(unit)}`, { method })
    if (!res.ok) throw new Error('Toggle failed')
  } catch {
    // Revert on failure
    setServices(prev =>
      prev.map(s => s.unit === unit ? { ...s, isWatched: currentlyWatched } : s)
    )
  }
}
```

**Why optimistic:** The Star toggle feels instant. The 10-second polling will re-confirm the true state from the server on next cycle.

### Pattern 7: SearchFilterBar Component

**What:** Self-contained component with search input and status filter buttons.
**When to use:** Rendered above the ServiceTable in Home.tsx.

```typescript
// src/components/SearchFilterBar.tsx
import { Search, X } from 'lucide-react'

type StatusFilter = 'all' | 'running' | 'stopped' | 'failed'

interface SearchFilterBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  statusFilter: StatusFilter
  onStatusChange: (s: StatusFilter) => void
  totalCount: number
  filteredCount: number
}

const STATUS_BUTTONS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Stopped', value: 'stopped' },
  { label: 'Failed', value: 'failed' },
]

export default function SearchFilterBar({
  searchQuery, onSearchChange,
  statusFilter, onStatusChange,
  totalCount, filteredCount,
}: SearchFilterBarProps) {
  return (
    <div className="flex items-center gap-3 mb-3">
      {/* Search input */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          type="text"
          placeholder="Search services..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 bg-bg-elevated border border-border rounded text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        {searchQuery && (
          <button onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2">
            <X className="w-3 h-3 text-text-muted hover:text-text-primary" />
          </button>
        )}
      </div>

      {/* Status filter buttons */}
      <div className="flex items-center gap-1">
        {STATUS_BUTTONS.map(({ label, value }) => (
          <button key={value}
            onClick={() => onStatusChange(value)}
            className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
              statusFilter === value
                ? 'bg-accent text-bg-base'
                : 'text-text-muted hover:text-accent border border-border hover:border-accent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Count */}
      {(searchQuery || statusFilter !== 'all') && (
        <span className="text-text-muted text-xs font-mono">
          {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  )
}
```

### Pattern 8: Watched Section at Top of Home

**What:** A collapsible or always-visible section above the main filtered list showing watched services.
**When to use:** When at least one service has `isWatched === true`.

```typescript
// In Home.tsx, before the main ServiceTable
{watchedServices.length > 0 && (
  <div className="mb-4">
    <div className="flex items-center gap-2 mb-2 px-1">
      <Star className="w-3.5 h-3.5 text-accent" />
      <span className="text-text-muted text-xs font-mono uppercase tracking-wider">
        Watched ({watchedServices.length})
      </span>
    </div>
    <div className="bg-bg-surface border border-accent/20 rounded-md overflow-auto mb-1">
      <ServiceTable
        services={watchedServices}
        onServiceUpdate={handleServiceUpdate}
        onToggleWatch={handleToggleWatch}
        isWatchedSection
      />
    </div>
  </div>
)}
```

**Design note:** The watched section shows all watched services regardless of the active search/status filter. The main list below respects all filters. This matches the PRD intent: "quick access."

### Anti-Patterns to Avoid

- **Filtering on the server (query params like `/api/services?q=nginx`):** Unnecessary — client-side is faster, requires no server changes, and the data is already polled. Don't add query param handling to `GET /api/services`.
- **Storing watched state in localStorage:** Creates sync issues between tabs and doesn't survive server-side lookups. SQLite is already in the stack.
- **Debouncing the search input:** At 173 services, filter is < 0.05ms. Debounce adds complexity with zero benefit.
- **Using `useDeferredValue` or `useTransition` for filtering:** React concurrent features are for expensive renders. Filtering 173 items is not expensive.
- **Separate GET /api/watched endpoint + client-side merge:** Two API calls on page load vs one. Merge server-side in `getAllServices()` instead.
- **Star button triggering full page re-fetch:** Use optimistic update (`setServices`) + server persist. The 10s poll handles eventual consistency.
- **Showing watched services only when no filters are active:** Watched section should always be visible regardless of search/filter state — it's the whole point.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fuzzy search | Custom Levenshtein distance | Simple `String.includes()` | Unit names are exact identifiers; substring match is what users type (e.g. "nginx", "ssh", "docker") |
| Watch state sync | In-memory Map on server | SQLite `watched_services` table | Already in stack; survives server restart; no extra code |
| Status count badges | Re-filter entire list per badge | Single pass with `reduce()` | Four counters in one `.reduce()` call |
| Search debounce | `setTimeout` + `clearTimeout` | None (no debounce needed) | 173 items filtered in 0.04ms — debounce costs more than it saves |
| URL-param persistence of filter state | React Router `useSearchParams` | Local `useState` | Filter state is session-local; not worth URL complexity in Phase 3 |

**Key insight:** The entire feature set fits in about 200 lines of new code across 4 files. The complexity is low because React's `useMemo` and SQLite's synchronous API are exactly the right tools here.

---

## Common Pitfalls

### Pitfall 1: "Running" Filter Includes Exited One-Shot Services
**What goes wrong:** Using `s.active === 'active'` for the "running" filter shows 60 services (24 running + 36 exited), not the expected 24.
**Why it happens:** One-shot services like `apparmor`, `apport`, and `cloud-config` have `active=active` but `sub=exited`. They ran, completed, and are "active" in systemd terms but not "running."
**How to avoid:** Filter on `s.sub === 'running'` (not `s.active === 'active'`) for the "running" status filter.
**Warning signs:** More services shown under "Running" than expected; exited services like `apparmor.service` appearing as "running."

### Pitfall 2: Watched Section Disappears During Search
**What goes wrong:** If `watchedServices = filteredServices.filter(s => s.isWatched)`, the watched section vanishes when the user searches for something that doesn't match the watched service name.
**Why it happens:** The watched section was derived from the filtered list instead of the full services list.
**How to avoid:** Derive `watchedServices` from `services` (unfiltered), not from `filteredServices`. Only the main table uses `filteredServices`.
**Warning signs:** Star button for a watched service disappears when typing in search.

### Pitfall 3: Backslash Unit Names Rejected by SERVICE_NAME_RE
**What goes wrong:** Clicking the watch star for `systemd-fsck@dev-disk-by\x2dlabel-BOOT.service` returns 400.
**Why it happens:** The existing `SERVICE_NAME_RE = /^[\w@\-.]+$/` in exec.js rejects backslash. The watched route naively reuses this regex.
**How to avoid:** Use a separate, wider regex in `server/routes/watched.js` that allows backslash. The watched route never calls systemctl, so the stricter exec.js regex is not needed here.
**Warning signs:** 400 errors in the browser console for template/escape-encoded service names.

### Pitfall 4: isWatched Missing from ServiceEntry Type
**What goes wrong:** TypeScript compiler errors in `ServiceRow.tsx` when accessing `service.isWatched`; props don't type-check.
**Why it happens:** `ServiceEntry` interface in `src/types/service.ts` doesn't include the new field.
**How to avoid:** Add `isWatched: boolean` to `ServiceEntry` as the first step. The server merges this field before sending the response, so the API shape changes too.
**Warning signs:** TypeScript error: `Property 'isWatched' does not exist on type 'ServiceEntry'`.

### Pitfall 5: Watch Toggle Overwrites Polling Update
**What goes wrong:** User clicks star, optimistic update fires, then 10-second poll fires and overwrites `isWatched: true` with the server's stale value (if the POST to `/api/watched` hasn't been committed yet).
**Why it happens:** The poll calls `setServices(data.services)` which replaces the entire array, including the optimistically-updated `isWatched`.
**How to avoid:** The `POST /api/watched/:name` endpoint is synchronous (SQLite is sync). By the time the next poll fires (10 seconds later), the write is committed. The poll will return `isWatched: true` from the merged response. No race condition in practice.
**Warning signs:** Star flickers (watched → unwatched → watched) immediately after clicking.

### Pitfall 6: Empty State Missing When Filters Match Nothing
**What goes wrong:** The table is empty with no explanation. Users assume the app is broken.
**Why it happens:** `ServiceTable` renders `"No services found"` but doesn't distinguish between "loading" and "filter matched nothing."
**How to avoid:** Pass the active filter state to `ServiceTable` (or render an empty state in `Home.tsx` above the table). Show a message like `'No services match "nginx" — clear search'` with a clear button.
**Warning signs:** User-testing feedback: "Is it broken?" when searching for a nonexistent name.

---

## Code Examples

Verified patterns from live system testing:

### Service Status Filter Logic (confirmed against 173 live services)
```typescript
// Source: verified against live systemctl output (2026-02-21)
// Status combinations on this machine:
//  113x active=inactive sub=dead     (stopped)
//   36x active=active   sub=exited   (one-shot services that completed)
//   24x active=active   sub=running  (running)
//    0x active=failed   sub=failed   (none currently, but supported)

const filteredServices = useMemo(() => {
  let result = services
  if (searchQuery.trim()) {
    const lower = searchQuery.toLowerCase()
    result = result.filter(s => s.unit.toLowerCase().includes(lower))
  }
  switch (statusFilter) {
    case 'running': result = result.filter(s => s.sub === 'running');      break
    case 'stopped': result = result.filter(s => s.active === 'inactive');  break
    case 'failed':  result = result.filter(s => s.active === 'failed');    break
  }
  return result
}, [services, searchQuery, statusFilter])
```

### SQLite CRUD for watched_services (confirmed working)
```javascript
// Source: verified with better-sqlite3 12.6.2 + SQLite 3.51.2 (2026-02-21)
import db from '../db.js'

// Prepare once at module load (not inside request handlers)
const stmts = {
  add:    db.prepare('INSERT OR IGNORE INTO watched_services (unit) VALUES (?)'),
  remove: db.prepare('DELETE FROM watched_services WHERE unit = ?'),
  list:   db.prepare('SELECT unit FROM watched_services ORDER BY added_at ASC'),
}

// In request handler:
stmts.add.run('nginx.service')    // idempotent
stmts.remove.run('nginx.service') // safe even if not present
const set = new Set(stmts.list.all().map(r => r.unit))
```

### Icon Imports (all confirmed in lucide-react 0.575.0)
```typescript
// Source: verified by ESM import test (2026-02-21)
import {
  Star,       // watched = true (filled star appearance)
  StarOff,    // watched = false (or just use Star with muted color)
  Search,     // search input prefix icon
  X,          // clear search button
  Filter,     // optional filter icon for mobile compact view
} from 'lucide-react'
```

### Star Toggle in ServiceRow
```typescript
// In ServiceRow.tsx actions cell, added alongside existing action buttons
<button
  onClick={() => onToggleWatch(service.unit, service.isWatched)}
  title={service.isWatched ? 'Unwatch' : 'Watch'}
  className={`p-1 rounded transition-colors ${
    service.isWatched
      ? 'text-accent hover:text-accent/70'
      : 'text-text-muted hover:text-accent'
  }`}
>
  {service.isWatched
    ? <Star className="w-3.5 h-3.5" />
    : <StarOff className="w-3.5 h-3.5" />
  }
</button>
```

### Mount Watched Router in server/index.js
```javascript
import watchedRouter from './routes/watched.js'
app.use('/api/watched', watchedRouter)
// Add after existing app.use('/api/services', servicesRouter) line
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Server-side filtered endpoint (`/api/services?q=nginx`) | Client-side `useMemo` filter on polled data | No extra server round-trip; instant response; simpler code |
| localStorage for favorites | SQLite `watched_services` table | Survives server restart; consistent across browser tabs; already in stack |
| Separate `/api/watched` GET + client merge | `isWatched: boolean` merged in `getAllServices()` server-side | One API response shape; one polling hook; no extra fetch |
| Debouncing search input | No debounce (direct state update) | At 173 items, filter is < 0.05ms — simpler is better |
| URL state for filters (`?status=running`) | Local `useState` | Avoids React Router search param complexity; session-local is fine for filters |

**Deprecated/outdated patterns:**
- `useSearchParams` for filter persistence: overkill for this use case; URL state is for shareable/bookmarkable filter views, not needed here
- `useDeferredValue` for search: React 18+ concurrent feature for expensive renders; 173-item filter is not expensive

---

## Open Questions

1. **Should search also match service description, not just unit name?**
   - What we know: The requirement says "search by name"; `service.unit` is the name
   - What's unclear: Whether admins would find description search useful (e.g., searching "web server" to find nginx)
   - Recommendation: Implement name-only search per the requirement. Description search can be added in a future phase if requested. Adding it later is trivial (change `s.unit.toLowerCase()` to `(s.unit + ' ' + s.description).toLowerCase()`).

2. **Should the watched section be collapsible?**
   - What we know: Success criteria says "watched services appear in a dedicated section or are visually distinguished" — both are valid
   - What's unclear: At scale (many watched services), the section could push the main list down significantly
   - Recommendation: Render it always-visible but with a compact style. If an admin watches many services, the visual weight is their feedback that they're over-watching. Skip collapsible for now — it's an interaction detail that can be added later without structural changes.

3. **Should the status filter show counts (e.g., "Running (24)")?**
   - What we know: The PRD shows filter buttons without counts; existing UX shows `X services` count
   - What's unclear: Whether counts per filter are expected vs optional
   - Recommendation: Add counts to filter buttons — they're a single `reduce()` pass over `services` and give admins instant awareness of system health. Shows as `Running (24)`, `Stopped (113)`, `Failed (0)`.

---

## Sources

### Primary (HIGH confidence)
- Live `systemctl list-units --all --type=service` execution (2026-02-21) — 173 services, status distribution confirmed: 24 running, 113 stopped (inactive/dead), 36 exited, 0 failed
- `better-sqlite3` 12.6.2 CRUD test with SQLite 3.51.2 — `CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`, `DELETE`, `SELECT` all verified working
- `lucide-react` 0.575.0 ESM import test — `Star`, `StarOff`, `Search`, `X`, `Filter`, `Eye`, `EyeOff` all confirmed exported
- React 19.2.0 ESM import test — `useMemo`, `useState`, `useCallback`, `useDeferredValue`, `useTransition` all confirmed
- `SERVICE_NAME_RE` in `server/utils/exec.js` — confirmed rejects backslash; watched route needs separate regex
- `encodeURIComponent()` round-trip test — backslash unit names (`systemd-fsck@dev-disk-by\x2dlabel-BOOT.service`) encode/decode correctly
- Performance benchmark: 10,000 dual-filter iterations on 173 services in 76ms = 0.0076ms per filter pass

### Secondary (MEDIUM confidence)
- React `useMemo` documentation (react.dev) — correct hook for derived state from existing data
- better-sqlite3 README — `db.prepare()` at module level (not inside request handlers) is the documented pattern for performance

### Tertiary (LOW confidence)
- None required — all claims verified directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all verified against installed packages
- Filter logic: HIGH — verified against live systemctl data; field values confirmed
- SQLite schema: HIGH — verified with better-sqlite3 12.6.2 + SQLite 3.51.2
- Architecture patterns: HIGH — consistent with Phase 2 established patterns
- Pitfalls: HIGH — discovered through direct testing (backslash names, exited vs running, watched derivation source)

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days; all components are stable)
