# Phase 4: Log Viewer - Research

**Researched:** 2026-02-21
**Domain:** journalctl (systemd journal), Express REST API, React Router v7 routing, Tailwind v4 log coloring
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOGS-01 | User can view last N lines of logs for a specific service | `journalctl -u <service> -n <N> --no-pager --output=json -q` via execFile; JSON output provides MESSAGE + PRIORITY per line; service name validated with existing SERVICE_NAME_RE; N defaults to 100; API endpoint GET /api/logs/:service?lines=100 |
| LOGS-02 | User can filter logs by time range (last 5m, 15m, 1h, 6h, 1d) | `--since=-5m`, `--since=-15m`, `--since=-1h`, `--since=-6h`, `--since=-1d` all verified to work with execFile (no shell needed); time preset maps to a `since` query param; all five syntaxes confirmed valid on Ubuntu 24.04 systemd 255 |
| LOGS-03 | Log lines are color-coded by level (errors red, warnings amber) | journalctl JSON output includes `PRIORITY` field (syslog integer: 0-7); PRIORITY <= 3 = error (red = `text-danger` = #ef4444); PRIORITY == 4 = warning (amber = `text-warning` = #f59e0b); PRIORITY >= 5 = normal; color classes already defined in index.css |
</phase_requirements>

---

## Summary

Phase 4 adds a log viewer that fetches journalctl output per service through a new backend endpoint and renders it in a dedicated frontend page. The implementation requires no new npm packages — all functionality is achievable with the existing stack (Node.js execFile, Express 5, React, Tailwind v4).

The backend adds a single new route `GET /api/logs/:service` that calls `journalctl -u <service> -n <lines> --since=<range> --no-pager --output=json -q` via execFile. The `--output=json` flag is the key: it emits one JSON object per line, each containing a `PRIORITY` field (integer 0–7) and `MESSAGE` field. The server normalizes each entry to `{ ts, priority, level, identifier, message }` before sending the response. No streaming is involved — this is a request/response batch fetch. Live streaming is deferred to v2 (LIVE-01).

The frontend adds a `/logs` route (replacing the ComingSoon catch-all) and a `/logs/:service` route. The `/logs` page shows a service selector; `/logs/:service` shows the log viewer with time range preset buttons and a color-coded log list. A "View Logs" link is added to each ServiceRow to navigate directly to `/logs/:service`. All color constants (`text-danger`, `text-warning`) already exist in the project's CSS theme.

**Primary recommendation:** Add `server/routes/logs.js` with a single GET endpoint using execFile + journalctl JSON mode. Add `src/pages/Logs.tsx` and `src/pages/LogViewer.tsx` (or a combined page with service selector). Add "View Logs" link in ServiceRow. No new packages needed.

---

## Standard Stack

### Core (all already installed — no additions needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:child_process execFile | built-in | Spawn journalctl safely | Established project pattern (INFR-03) |
| express | ^5.2.1 | New /api/logs/:service route | Already in project |
| react | ^19.2.0 | Log viewer page components | Already in project |
| react-router | ^7.13.0 | /logs and /logs/:service routes + useParams | Already in project |
| lucide-react | ^0.575.0 | Clock, Filter, History, ScrollText icons (all confirmed present at v0.575.0) | Already in project |
| tailwindcss | ^4.2.0 | Log line coloring, time preset buttons | Already in project |

### NOT needed (do not add)
- No virtual scrolling library (react-virtual, react-window) — 100–200 lines renders fine in a standard scrollable div; virtual scrolling adds complexity for no gain at this scale
- No ANSI strip library — journalctl `--output=json` message field is already plain text, no ANSI codes
- No log parsing library — journalctl JSON output is structured; no line parsing needed
- No debounce utility — preset buttons trigger fetch, no free-text input
- No date/time library (dayjs, date-fns) — `new Date(parseInt(ts, 10) / 1000).toISOString()` is sufficient

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended File Changes
```
server/
├── utils/
│   └── exec.js              # NO CHANGE needed — journalctl gets its own util
└── routes/
    └── logs.js              # NEW: GET /api/logs/:service
server/index.js              # MODIFY: mount logsRouter at /api/logs

src/
├── App.tsx                  # MODIFY: add /logs and /logs/:service routes
├── pages/
│   └── Logs.tsx             # NEW: combined log viewer page with service selector
└── components/
    └── ServiceRow.tsx       # MODIFY: add "View Logs" link/button
```

### Pattern 1: journalctl JSON Batch Fetch (Backend)

**What:** Spawn journalctl with `--output=json` and parse line-delimited JSON to extract priority + message.

**Why JSON not short/short-precise:** JSON output provides the structured `PRIORITY` field directly. Parsing priority from text output (e.g. detecting "error:" substrings in free-form log messages) is unreliable and brittle.

**Example — `server/routes/logs.js`:**
```javascript
import express from 'express'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const router = express.Router()

// Reuse existing SERVICE_NAME_RE from exec.js (INFR-04)
import { SERVICE_NAME_RE } from '../utils/exec.js'

const VALID_LINES = /^\d+$/
const VALID_SINCE = { '5m': '-5m', '15m': '-15m', '1h': '-1h', '6h': '-6h', '1d': '-1d' }

router.get('/:service', async (req, res, next) => {
  try {
    const { service } = req.params
    if (!SERVICE_NAME_RE.test(service)) {
      return res.status(400).json({ ok: false, error: 'Invalid service name' })
    }

    const linesRaw = req.query.lines ?? '100'
    const sinceKey = req.query.since ?? 'all'

    if (!VALID_LINES.test(linesRaw) || parseInt(linesRaw, 10) > 1000) {
      return res.status(400).json({ ok: false, error: 'Invalid lines parameter' })
    }

    const args = [
      '--no-pager', '-q',
      '-u', service,
      '-n', linesRaw,
      '--output', 'json',
    ]

    if (sinceKey !== 'all' && VALID_SINCE[sinceKey]) {
      args.push('--since', VALID_SINCE[sinceKey])
    }

    const { stdout } = await execFileAsync('/usr/bin/journalctl', args, {
      timeout: 15_000,
      maxBuffer: 5 * 1024 * 1024,
    })

    const entries = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const j = JSON.parse(line)
        const priority = parseInt(j.PRIORITY ?? '6', 10)
        const tsUs = parseInt(j.__REALTIME_TIMESTAMP ?? '0', 10)
        return {
          ts: tsUs ? new Date(tsUs / 1000).toISOString() : null,
          priority,
          level: priority <= 3 ? 'error' : priority === 4 ? 'warning' : 'info',
          identifier: j.SYSLOG_IDENTIFIER ?? j._COMM ?? '',
          message: Array.isArray(j.MESSAGE) ? j.MESSAGE.join('') : (j.MESSAGE ?? ''),
        }
      })

    res.json({ ok: true, service, entries })
  } catch (err) {
    next(err)
  }
})

export default router
```

### Pattern 2: Priority-Based Color Classes (Frontend)

**What:** Map the `level` field to Tailwind CSS classes using the existing theme colors.

**Color mapping:**
```
error  → text-danger   (#ef4444 red)   PRIORITY 0–3 (EMERG/ALERT/CRIT/ERR)
warning → text-warning (#f59e0b amber) PRIORITY 4   (WARNING)
info   → text-text-primary (default)   PRIORITY 5–7 (NOTICE/INFO/DEBUG)
```

**Example — log line rendering:**
```tsx
function LogLine({ entry }: { entry: LogEntry }) {
  const colorClass =
    entry.level === 'error' ? 'text-danger' :
    entry.level === 'warning' ? 'text-warning' :
    'text-text-primary'

  return (
    <div className={`font-mono text-xs leading-5 ${colorClass} whitespace-pre-wrap break-all`}>
      <span className="text-text-muted mr-2 select-none">{entry.ts?.slice(11, 23) ?? '--'}</span>
      <span className="text-text-muted mr-2 select-none">{entry.identifier}</span>
      {entry.message}
    </div>
  )
}
```

### Pattern 3: Time Range Preset Buttons (Frontend)

**What:** Static preset buttons that re-fetch logs when selected. No free-text date input.

```tsx
const PRESETS = [
  { label: 'Last 5m',  value: '5m' },
  { label: 'Last 15m', value: '15m' },
  { label: 'Last 1h',  value: '1h' },
  { label: 'Last 6h',  value: '6h' },
  { label: 'Last 1d',  value: '1d' },
  { label: 'All',      value: 'all' },
]

// On mount and on preset change: fetch /api/logs/:service?lines=100&since=<value>
```

### Pattern 4: Routing (Frontend)

**What:** React Router v7 nested routes under the existing Layout. The `/logs` route shows a service selector or a welcome prompt; `/logs/:service` shows the log viewer for that service. ServiceRow gets a "View Logs" button that navigates to `/logs/:service`.

**App.tsx modification:**
```tsx
import Logs from './pages/Logs'

// Inside <Routes><Route element={<Layout />}>:
<Route path="logs" element={<Logs />} />
<Route path="logs/:service" element={<Logs />} />
// Remove or keep the ComingSoon catch-all for /settings
```

**ServiceRow navigation (react-router Link):**
```tsx
import { Link } from 'react-router'
// Inside the actions cell:
<Link
  to={`/logs/${encodeURIComponent(service.unit)}`}
  title="View Logs"
  className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent transition-colors"
>
  <ScrollText className="w-3.5 h-3.5" />
</Link>
```

### Anti-Patterns to Avoid
- **Parsing log level from message text:** Don't try to detect errors by scanning for "error", "Error", "ERROR" substrings in the message string. The `PRIORITY` field from JSON output is authoritative and handles all cases.
- **Shell string construction:** Don't concatenate `--since=-${userInput}` — the `since` query param must be whitelist-validated before being added to the args array. The `VALID_SINCE` object acts as the whitelist.
- **Streaming response for batch fetch:** Don't use SSE or chunked transfer encoding for this. Phase 4 is request/response. Streaming is Phase 5+ (v2 LIVE-01).
- **maxBuffer set too low:** 100 lines of JSON averages ~1.2KB each = ~120KB for 100 entries. The 5MB maxBuffer from the existing systemctl pattern is sufficient and should be reused.
- **Using --output=short and parsing text:** Short output format does not expose priority level in a machine-readable way. JSON is the correct output mode.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ANSI color stripping | Custom regex stripper | Not needed — use --output=json | JSON output has no ANSI codes; text output would need stripping |
| Log level detection | Regex scanning message text | PRIORITY field from JSON | PRIORITY is authoritative; text detection has false positives |
| Time range validation | Free-form date parsing | VALID_SINCE whitelist object | Only 5 presets needed; whitelist is one line and injection-safe |
| Priority integer conversion | Custom enum | Inline ternary `<= 3 ? 'error' : === 4 ? 'warning' : 'info'` | Syslog priority mapping is simple; no enum needed |

**Key insight:** journalctl's `--output=json` mode does the hard work. Structured output eliminates the need for custom parsers, ANSI strippers, or log format detectors.

---

## Common Pitfalls

### Pitfall 1: MESSAGE field can be an array
**What goes wrong:** Some journal entries (typically kernel messages or binary data) have `MESSAGE` as a JSON array instead of a string.
**Why it happens:** The journald JSON format allows MESSAGE to be a base64-encoded binary or an array of strings for multiline messages.
**How to avoid:** Guard with `Array.isArray(j.MESSAGE) ? j.MESSAGE.join('') : (j.MESSAGE ?? '')` in the parser.
**Warning signs:** `JSON.parse` succeeds but `entry.message.toLowerCase()` throws "toLowerCase is not a function".

### Pitfall 2: __REALTIME_TIMESTAMP is microseconds, not milliseconds
**What goes wrong:** `new Date(parseInt(ts, 10))` produces a date in 1970 (treating microseconds as milliseconds).
**Why it happens:** journald stores timestamps in microseconds since epoch. JavaScript `Date` expects milliseconds.
**How to avoid:** Always divide by 1000: `new Date(parseInt(j.__REALTIME_TIMESTAMP, 10) / 1000)`.
**Warning signs:** Timestamps show 1970-01-01 in the UI.

### Pitfall 3: journalctl exits 0 when no entries match
**What goes wrong:** A 200 response with `entries: []` is mistaken for an error by the frontend.
**Why it happens:** journalctl exit code 0 for "no entries in time range" and for "entries found" are the same.
**How to avoid:** The API correctly returns `{ ok: true, entries: [] }`. Frontend should show "No log entries for this time range" message rather than an error state.
**Warning signs:** Frontend treats empty array as fetch error.

### Pitfall 4: PRIORITY field is absent for some kernel/transport entries
**What goes wrong:** `parseInt(j.PRIORITY, 10)` returns NaN when PRIORITY is missing.
**Why it happens:** Not all journal entries have an explicit PRIORITY. Kernel ring buffer entries and some transport entries may omit it.
**How to avoid:** Default to 6 (INFO) when absent: `parseInt(j.PRIORITY ?? '6', 10)`.
**Warning signs:** All log lines are unstyled despite containing errors.

### Pitfall 5: execFile error when journalctl finds no entries for a unit
**What goes wrong:** execFile rejects with an error even though exit code is 0.
**Why it happens:** This should NOT happen — journalctl exits 0 for empty results. However, if the unit name contains characters that journalctl rejects (despite passing SERVICE_NAME_RE), journalctl may exit with code 1.
**How to avoid:** Use try/catch in the route handler. Check if `err.stdout` is available — journalctl often writes partial output even on error exit. Log `err.code` for diagnosis.
**Warning signs:** Route handler catches an error for a valid unit name.

### Pitfall 6: maxBuffer exceeded for high-volume services
**What goes wrong:** execFile throws `RangeError: stdout maxBuffer length exceeded` for services with very verbose logs.
**Why it happens:** The `-n 100` limit with `--output=json` produces ~120KB per 100 lines on average. But services like nginx under heavy load can generate much larger entries.
**How to avoid:** Cap `lines` at 1000 in the route handler validation. The 5MB maxBuffer accommodates up to ~4000 typical log lines.
**Warning signs:** Route handler catches a maxBuffer error; the error message mentions "stdout maxBuffer length exceeded".

### Pitfall 7: --since relative time with sub-minute presets
**What goes wrong:** `--since=-5m` returns 0 results even though the service logged recently.
**Why it happens:** This is an access issue — if the server runs as the current user (not root), journalctl only sees user-journal entries, not system service entries.
**How to avoid:** Ensure the server runs as root (per PROJECT.md: "Server runs as root for direct systemctl access"). Root user sees the full system journal.
**Warning signs:** Commands work fine in the terminal as root but return 0 entries via API.

---

## Code Examples

### Full journalctl command construction
```javascript
// Source: verified locally on Ubuntu 24.04 systemd 255
// All five presets and 'all' confirmed working via execFile (no shell)
const VALID_SINCE = { '5m': '-5m', '15m': '-15m', '1h': '-1h', '6h': '-6h', '1d': '-1d' }

const args = [
  '--no-pager',
  '-q',                    // suppress hint messages (e.g. "Hint: You are not seeing all messages")
  '-u', serviceName,       // validated against SERVICE_NAME_RE before use
  '-n', String(lines),     // capped at 1000, defaults to 100
  '--output', 'json',      // structured output: one JSON object per line
]
if (sinceKey !== 'all' && VALID_SINCE[sinceKey]) {
  args.push('--since', VALID_SINCE[sinceKey])  // relative time, validated via whitelist
}

const { stdout } = await execFileAsync('/usr/bin/journalctl', args, {
  timeout: 15_000,
  maxBuffer: 5 * 1024 * 1024,
})
```

### Priority → level mapping
```javascript
// syslog priority: 0=EMERG 1=ALERT 2=CRIT 3=ERR 4=WARNING 5=NOTICE 6=INFO 7=DEBUG
// Source: man journalctl + verified against live JSON output
const priority = parseInt(j.PRIORITY ?? '6', 10)
const level = priority <= 3 ? 'error' : priority === 4 ? 'warning' : 'info'
```

### Timestamp conversion (microseconds to ISO string)
```javascript
// Source: verified locally — __REALTIME_TIMESTAMP is microseconds since epoch
const tsUs = parseInt(j.__REALTIME_TIMESTAMP ?? '0', 10)
const ts = tsUs ? new Date(tsUs / 1000).toISOString() : null
```

### TypeScript type for log entry
```typescript
// src/types/log.ts (new file)
export interface LogEntry {
  ts: string | null        // ISO 8601 timestamp or null
  priority: number         // syslog integer 0-7
  level: 'error' | 'warning' | 'info'
  identifier: string       // SYSLOG_IDENTIFIER (e.g. 'nginx', 'systemd')
  message: string
}
```

### useLogFetch hook pattern
```typescript
// Mirrors useServicePolling pattern — same shape
export function useLogFetch(service: string, lines: number, since: string) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ lines: String(lines), since })
      const res = await fetch(`/api/logs/${encodeURIComponent(service)}?${params}`)
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const data = await res.json()
      setEntries(data.entries)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [service, lines, since])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return { entries, loading, error, refresh: fetchLogs }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `--output=short` + regex parsing for level | `--output=json` + PRIORITY field | Available since systemd 187 | Reliable, injection-safe level detection |
| `exec()` shell string | `execFile()` with args array | Project decision (Phase 1) | Prevents command injection; no quoting issues |
| Custom syslog parser | journalctl native JSON | - | No parsing edge cases; MESSAGE, PRIORITY, TIMESTAMP all structured |

**Deprecated/outdated:**
- `--output=short-monotonic` for timestamps: use `--output=json` + `__REALTIME_TIMESTAMP` instead; monotonic timestamps don't convert to wall-clock time without additional context.

---

## Open Questions

1. **Service selector UX on /logs (no service selected)**
   - What we know: Layout sidebar links `/logs` directly; the phase success criteria say "Opening the log view for a service" implies navigating to a specific service
   - What's unclear: Should `/logs` with no `:service` show a service picker dropdown/combobox, or just redirect to the first service, or show a "select a service" prompt?
   - Recommendation: Show a centered prompt "Select a service to view logs" with either a dropdown of all services (reuse /api/services) or a "Navigate from the Services tab" message. A dropdown is more complete; a prompt is simpler. Planner's discretion.

2. **Default line count (N in LOGS-01)**
   - What we know: "last N lines" — N is unspecified in requirements
   - What's unclear: What should N default to?
   - Recommendation: Default 100 lines. Expose as a fixed preset (50/100/200) or fixed at 100. Research shows 100 JSON lines ≈ 120KB, well within maxBuffer.

3. **Log viewer entry point from service list**
   - What we know: The phase adds a log view; ServiceRow currently has action buttons only
   - What's unclear: Should "View Logs" be a button in the ServiceRow actions column, a row-click handler, or a dedicated icon link?
   - Recommendation: Add a `ScrollText` icon button to the ServiceRow actions column (after the star toggle, before start/stop). Uses existing pattern, consistent placement, no click-target confusion with row selection.

4. **Zombie process cleanup flag from STATE.md**
   - What we know: The research flag mentions SIGTERM + SIGKILL + stream.destroy() for journalctl process cleanup
   - What's unclear: This concern applies to long-running streaming processes (journalctl -f), not to one-shot batch fetches
   - Recommendation: Phase 4 uses one-shot execFile calls that complete and exit normally. The zombie process cleanup concern is deferred to v2 (LIVE-01 WebSocket streaming). No action needed in Phase 4.

---

## Sources

### Primary (HIGH confidence)
- Verified locally — `man journalctl` systemd 255 on Ubuntu 24.04 (live on target machine)
- Verified locally — `node -e "execFile('/usr/bin/journalctl', ...)"` all five time presets + JSON output tested
- Verified locally — JSON field structure: PRIORITY, MESSAGE, __REALTIME_TIMESTAMP, SYSLOG_IDENTIFIER
- Project codebase read — `server/utils/exec.js`, `server/routes/services.js`, `src/types/service.ts`, `src/index.css`, `package.json`

### Secondary (MEDIUM confidence)
- journald JSON format: MESSAGE array behavior — documented in systemd.journal-fields(7) man page; confirmed guard is needed per spec

### Tertiary (LOW confidence)
- None — all critical claims verified against live system or project codebase

---

## Metadata

**Confidence breakdown:**
- journalctl flags and output format: HIGH — tested live on Ubuntu 24.04 systemd 255
- Priority-to-level mapping: HIGH — JSON PRIORITY field tested live; syslog constants are stable POSIX
- Time range syntax: HIGH — all 5 presets tested via execFile (not shell)
- React routing pattern: HIGH — existing App.tsx and Layout.tsx read directly; react-router v7 imported from 'react-router'
- Frontend component structure: HIGH — follows established patterns from Phase 2/3; no new libraries
- Icon availability: HIGH — confirmed clock.js, timer.js, history.js, filter.js, scroll-text.js, file-text.js present in lucide-react 0.575.0
- MESSAGE array pitfall: MEDIUM — documented in spec; not observed in test data (no binary entries in test journal)

**Research date:** 2026-02-21
**Valid until:** 2026-08-21 (stable APIs: journalctl JSON format, syslog priority constants, React Router v7 — all stable/non-breaking)
