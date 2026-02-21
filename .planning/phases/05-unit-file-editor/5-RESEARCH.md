# Phase 5: Unit File Editor - Research

**Researched:** 2026-02-21
**Domain:** systemd unit file I/O, atomic file writes, CodeMirror 6 React editor, INI syntax highlighting, daemon-reload
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UNIT-01 | User can view the content of a service's unit file | `systemctl show -p FragmentPath <service>` returns the on-disk path; `fs.readFile(path, 'utf8')` reads it; path validated against allowed-prefix allowlist before read; route `GET /api/unit/:service` returns `{ ok, content, path, writable }` |
| UNIT-02 | User can edit unit files with INI/systemd syntax highlighting | `@uiw/react-codemirror` 4.25.4 with `@codemirror/legacy-modes/mode/properties` provides INI-style `[Section]` header and `key=value` pair highlighting; `StreamLanguage.define(properties)` passed as an extension; React 19 satisfied by peerDep `>=17.0.0` |
| UNIT-03 | Saving a unit file triggers automatic daemon-reload | `PUT /api/unit/:service` validates service name, resolves FragmentPath, enforces `/etc/systemd/system/` write-only policy, writes atomically (temp file + `fs.rename` same-dir), then runs `systemctl daemon-reload` via `execFile`; `daemon-reload` added to `ALLOWED_ACTIONS` in `exec.js` |
</phase_requirements>

---

## Summary

Phase 5 adds a unit file viewer and editor: a read-only view of the service's `.service` file and an edit mode with INI/systemd syntax highlighting. Three concerns drive implementation: (1) securely resolving the unit file path from `systemctl show`, (2) choosing a React code editor that adds syntax highlighting without excessive bundle cost, and (3) writing changes atomically and triggering `daemon-reload` without shell injection risk.

The path-resolution approach uses `systemctl show -p FragmentPath <service>` (already supported by `runSystemctl`) to get the authoritative on-disk path. The result is validated against an allowed-prefix allowlist before any file I/O. Reads are allowed from all standard systemd paths; writes are restricted to `/etc/systemd/system/` because package-managed files under `/usr/lib/systemd/system/` should not be overwritten directly.

For the editor, `@uiw/react-codemirror` 4.25.4 wraps CodeMirror 6 for React. The `properties` mode from `@codemirror/legacy-modes` handles INI-style `[Section]` headers and `key=value` pairs — a verified close match for systemd unit file syntax. The `daemon-reload` action must be added to `ALLOWED_ACTIONS` in `exec.js` and called after every successful write.

**Primary recommendation:** Add `GET /api/unit/:service` (read) and `PUT /api/unit/:service` (write + daemon-reload) routes in a new `server/routes/unit.js`. Add `/unit/:service` route in React with a UnitFile page that uses `@uiw/react-codemirror` with the `properties` language extension. Follow the exact same page shape as the Logs viewer (ArrowLeft back, service name header, read-only view with edit toggle).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs/promises | built-in | Read/write unit files atomically | Standard Node.js — no new package |
| node:path | built-in | Path prefix validation, temp file naming | Standard Node.js — no new package |
| express | ^5.2.1 | New `/api/unit/:service` GET and PUT routes | Already installed |
| `runSystemctl` (exec.js) | project util | `show -p FragmentPath` to resolve path; `daemon-reload` after write | Existing wrapper — only add `daemon-reload` to allowlist |
| `SERVICE_NAME_RE` (exec.js) | project util | Validate service name in new routes | Existing regex |
| react | ^19.2.0 | UnitFile page, edit/view toggle | Already installed |
| react-router | ^7.13.0 | `/unit/:service` route, `useParams` | Already installed |
| @uiw/react-codemirror | 4.25.4 | CodeMirror 6 React wrapper with controlled value, onChange | Must install |
| @codemirror/legacy-modes | 6.5.2 | `properties` mode for INI/systemd syntax | Must install |
| @codemirror/language | 6.12.1 | `StreamLanguage.define()` to wrap `properties` mode | Must install |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react icons | ^0.575.0 (installed) | `FileCode`, `Edit`, `Save`, `X`, `ArrowLeft`, `LoaderCircle` | UI buttons — all confirmed present in installed version |

**Confirmed available icons in installed lucide-react 0.575.0:**
- `file-code.js` — view-mode header icon
- `edit.js` / `pencil.js` — edit button
- `save.js` — save button
- `x.js` — cancel button
- `arrow-left.js` — back navigation (already used in Logs.tsx)
- `loader-circle.js` — saving spinner (already used in Logs.tsx)
- `check.js` — success confirmation
- `alert-triangle.js` — error state (already used in Logs.tsx)

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @uiw/react-codemirror + legacy-modes | Monaco Editor | Monaco ~5MB bundle, complex Vite setup (needs worker config); CodeMirror ~400KB for this combo; admin tool not a public page, but CodeMirror is clearly sufficient |
| @uiw/react-codemirror + legacy-modes | react-simple-code-editor + Prism | Prism doesn't have a maintained systemd/INI highlighter; CodeMirror has verified `properties` mode |
| @uiw/react-codemirror + legacy-modes | Plain `<textarea>` | UNIT-02 explicitly requires syntax highlighting — plain textarea fails the requirement |
| Atomic write (temp+rename) | Direct `fs.writeFile` | Direct write has a window where the file is empty if process dies mid-write; rename is atomic within same filesystem (verified: `/etc` and `/etc/systemd/system` are on same partition on this host) |

**Installation:**
```bash
npm install @uiw/react-codemirror @codemirror/legacy-modes @codemirror/language
```

---

## Architecture Patterns

### Recommended File Changes
```
server/
├── utils/
│   └── exec.js               MODIFY: add 'daemon-reload' to ALLOWED_ACTIONS
└── routes/
    └── unit.js               NEW: GET /api/unit/:service, PUT /api/unit/:service
server/index.js               MODIFY: mount unitRouter at /api/unit

src/
├── App.tsx                   MODIFY: add /unit and /unit/:service routes
├── types/
│   └── unit.ts               NEW: UnitFileInfo interface
└── pages/
    └── UnitFile.tsx          NEW: read-only viewer + CodeMirror edit mode
```

### Pattern 1: Resolving Unit File Path Safely (Backend)

**What:** Call `systemctl show -p FragmentPath <service>`, extract the value, validate it against an allowed-prefix list, then read with `fs.readFile`.

**Why not directly construct the path:** The path of a unit file varies: custom services are in `/etc/systemd/system/`, package-managed ones in `/usr/lib/systemd/system/`, some in `/lib/systemd/system/`. The `FragmentPath` property from `systemctl show` is the single authoritative source.

**Example — `server/routes/unit.js` (read endpoint):**
```javascript
import express from 'express'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { resolve, dirname, basename, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { SERVICE_NAME_RE, runSystemctl } from '../utils/exec.js'

const router = express.Router()

// Paths from which we allow reading unit files
const READ_PREFIXES = [
  '/etc/systemd/system/',
  '/usr/lib/systemd/system/',
  '/lib/systemd/system/',
  '/run/systemd/system/',
]

// Only /etc/systemd/system/ is writable — package-managed files must not be overwritten
const WRITE_PREFIX = '/etc/systemd/system/'

function validatePath(filePath, prefixes) {
  const resolved = resolve(filePath)  // collapses ../ traversal
  return prefixes.some(p => resolved.startsWith(p))
}

async function getFragmentPath(service) {
  const result = await runSystemctl('show', service, ['-p', 'FragmentPath'])
  // Output: "FragmentPath=/etc/systemd/system/nginx.service"
  const line = result.stdout.split('\n').find(l => l.startsWith('FragmentPath='))
  if (!line) return null
  const path = line.slice('FragmentPath='.length).trim()
  return path || null
}

// GET /api/unit/:service
router.get('/:service', async (req, res, next) => {
  try {
    const { service } = req.params
    if (!SERVICE_NAME_RE.test(service)) {
      return res.status(400).json({ ok: false, error: 'Invalid service name' })
    }

    const fragmentPath = await getFragmentPath(service)
    if (!fragmentPath) {
      return res.status(404).json({ ok: false, error: 'Unit file path not found' })
    }

    if (!validatePath(fragmentPath, READ_PREFIXES)) {
      return res.status(403).json({ ok: false, error: 'Unit file path not allowed' })
    }

    const content = await readFile(resolve(fragmentPath), 'utf8')
    const writable = validatePath(fragmentPath, [WRITE_PREFIX])

    return res.json({ ok: true, service, path: fragmentPath, content, writable })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, error: 'Unit file not found on disk' })
    }
    next(err)
  }
})
```

### Pattern 2: Atomic Write + daemon-reload (Backend)

**What:** Write to a temp file in the same directory as the destination (same filesystem guaranteed), then use `fs.rename` (atomic). After successful rename, call `runSystemctl('daemon-reload', null)`.

**Why temp-in-same-dir:** `fs.rename` is only atomic when source and destination are on the same filesystem. `/tmp` and `/etc` may be on different filesystems, causing rename to fall back to copy+delete (not atomic). Writing the temp file in the same directory as the destination guarantees same-filesystem.

**Example — `server/routes/unit.js` (write endpoint):**
```javascript
// PUT /api/unit/:service
router.put('/:service', async (req, res, next) => {
  try {
    const { service } = req.params
    const { content } = req.body  // string from request body

    if (!SERVICE_NAME_RE.test(service)) {
      return res.status(400).json({ ok: false, error: 'Invalid service name' })
    }

    if (typeof content !== 'string' || content.length === 0) {
      return res.status(400).json({ ok: false, error: 'content must be a non-empty string' })
    }

    // Content size guard: systemd unit files should never be larger than 1MB
    if (content.length > 1_000_000) {
      return res.status(400).json({ ok: false, error: 'content too large' })
    }

    const fragmentPath = await getFragmentPath(service)
    if (!fragmentPath) {
      return res.status(404).json({ ok: false, error: 'Unit file path not found' })
    }

    if (!validatePath(fragmentPath, [WRITE_PREFIX])) {
      return res.status(403).json({
        ok: false,
        error: 'Unit file is not in /etc/systemd/system/ — editing package-managed files is not allowed',
      })
    }

    const destPath = resolve(fragmentPath)
    const dir = dirname(destPath)
    const tmpPath = join(dir, '.tmp-' + basename(destPath) + '.' + randomBytes(4).toString('hex'))

    // Atomic write: temp file in same dir, then rename
    await writeFile(tmpPath, content, { encoding: 'utf8', mode: 0o644 })
    await rename(tmpPath, destPath)

    // daemon-reload after successful write
    await runSystemctl('daemon-reload', null)

    return res.json({ ok: true, service, path: fragmentPath })
  } catch (err) {
    next(err)
  }
})
```

### Pattern 3: Adding daemon-reload to exec.js Allowlist

**What:** `daemon-reload` must be added to `ALLOWED_ACTIONS` so `runSystemctl` will pass it through. It takes no service name (pass `null`) and no extra args.

**Example — `server/utils/exec.js` modification:**
```javascript
export const ALLOWED_ACTIONS = Object.freeze([
  'start', 'stop', 'restart', 'enable', 'disable',
  'status', 'is-active', 'is-enabled', 'show', 'list-units',
  'daemon-reload',   // ADD THIS — used by unit file writer after save
])
```

Usage: `await runSystemctl('daemon-reload', null)` — no service name, no extra args.

### Pattern 4: CodeMirror React Editor with INI/properties Mode

**What:** `@uiw/react-codemirror` accepts `value`, `onChange`, `extensions`, and `theme` props. The `properties` mode from `@codemirror/legacy-modes` is wrapped with `StreamLanguage.define()` and passed as an extension. A custom dark theme matching the project aesthetic is straightforward with the `theme="dark"` base and custom CSS.

**Installation:**
```bash
npm install @uiw/react-codemirror @codemirror/legacy-modes @codemirror/language
```

**Peer dependency verification:** `@uiw/react-codemirror@4.25.4` declares `react: >=17.0.0` — the project uses React 19.2.0, which satisfies this constraint. No conflict.

**Example — UnitFile.tsx editor section:**
```tsx
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'

const systemdLang = StreamLanguage.define(properties)

function UnitEditor({ content, onChange }: { content: string; onChange: (val: string) => void }) {
  return (
    <CodeMirror
      value={content}
      height="100%"
      theme="dark"
      extensions={[systemdLang]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
      }}
      style={{ fontFamily: 'JetBrains Mono Variable, monospace', fontSize: '13px' }}
    />
  )
}
```

**Note on `StreamLanguage.define(properties)` at module level:** Define it once outside the component (module-level constant) so it's not recreated on every render. This is the standard CodeMirror 6 pattern.

### Pattern 5: UnitFile Page Structure

**What:** Follows the same pattern as `Logs.tsx` — a page component that checks for the `:service` param, shows a prompt if absent, and renders the feature if present. Two modes: read-only view (displays content in a `<pre>`) and edit mode (displays CodeMirror editor). The mode toggle is a button.

**State machine:**
```
READ (default) --[Edit button]--> EDITING --[Save]--> SAVING --[success]--> READ
                                          --[Cancel]-> READ
```

**Route pattern (mirrors logs):**
```tsx
// In App.tsx — follows exact same pattern as /logs and /logs/:service
<Route path="unit" element={<UnitFile />} />
<Route path="unit/:service" element={<UnitFile />} />
```

**ServiceRow link (add a `FileCode` icon link alongside the `ScrollText` logs link):**
```tsx
import { FileCode } from 'lucide-react'

<Link
  to={`/unit/${encodeURIComponent(service.unit)}`}
  title="View Unit File"
  className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent transition-colors"
>
  <FileCode className="w-3.5 h-3.5" />
</Link>
```

**Navigation (sidebar):** The `Settings` nav item in `Layout.tsx` currently points to `/settings`. The planner may choose to leave it or replace it. A sidebar "Unit" item pointing to `/unit` is an option. This is a discretion call for the planner.

### Anti-Patterns to Avoid

- **Constructing the file path from the service name directly:** Don't assume `/etc/systemd/system/${serviceName}`. Always use `systemctl show -p FragmentPath` as the source of truth. Services can be symlinked, can live in `/usr/lib/`, or can have non-standard names.
- **Writing to /tmp then renaming to /etc/systemd/:** `fs.rename` across filesystems is not atomic (falls back to copy+delete). Write the temp file to the same directory as the destination.
- **Skipping the path prefix validation on write:** Even with a validated service name, the `FragmentPath` could theoretically point outside the allowed write area (e.g., if a unit file was symlinked from a non-standard location). Always check `resolve(fragmentPath).startsWith('/etc/systemd/system/')` before writing.
- **Calling daemon-reload before the rename succeeds:** Only call `daemon-reload` after `rename` completes. If `writeFile` or `rename` throws, the original file is untouched and daemon-reload must NOT be called.
- **Creating `systemdLang` inside the React component:** `StreamLanguage.define()` should be called once at module level, not on each render. Putting it inside the component creates a new extension instance on every render, causing CodeMirror to re-initialize.
- **Using the `@codemirror/view` `EditorView.theme()` for full styling:** The `@uiw/react-codemirror` wrapper's `theme="dark"` prop is sufficient for the dark base. A minimal `EditorView.theme()` extension can fine-tune background colors to match `#0a0e14` if needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| INI syntax highlighting | Custom tokenizer | `properties` mode from `@codemirror/legacy-modes` | Handles `[Section]`, `key=value`, `;`/`#` comments, multiline values correctly |
| Code editor with line numbers | `<textarea>` with overlaid `<pre>` | `@uiw/react-codemirror` | Scroll sync, selection, undo/redo, all done correctly; textarea overlay is a complex hack |
| Atomic file write | `fs.writeFile` directly | `writeFile(tmp) + rename(tmp, dest)` same-dir | Direct write corrupts file if process dies mid-write; rename is atomic within same filesystem |
| Path traversal prevention | String manipulation | `path.resolve()` then prefix check | `resolve` collapses `../` sequences correctly; string manipulation misses edge cases |
| Fragment path parsing | Regex on `systemctl cat` output | `systemctl show -p FragmentPath` | `systemctl show` is structured output; `systemctl cat` is human-readable and may include drop-in files |

**Key insight:** The `FragmentPath` property from `systemctl show` is the safe, structured way to get the unit file location. Never construct the path from the service name directly.

---

## Common Pitfalls

### Pitfall 1: FragmentPath is empty for unloaded or not-found services
**What goes wrong:** `systemctl show -p FragmentPath unknown.service` returns `FragmentPath=` (empty value) rather than a path.
**Why it happens:** If the service is not loaded (`LoadState=not-found`), systemd has no fragment path.
**How to avoid:** After parsing `FragmentPath=` from `show` output, check `path.length > 0` before proceeding. Return 404 with `{ ok: false, error: 'Unit file path not found' }`.
**Warning signs:** `fs.readFile('')` throws `ENOENT: no such file or directory, open ''`.

### Pitfall 2: Unit file in /usr/lib/systemd/system/ should be read-only from the editor
**What goes wrong:** User tries to save changes to `cron.service` (FragmentPath = `/usr/lib/systemd/system/cron.service`) and the write succeeds, overwriting a package-managed file.
**Why it happens:** The server runs as root; `fs.writeFile` on `/usr/lib/systemd/system/` succeeds without permission error.
**How to avoid:** Enforce `WRITE_PREFIX = '/etc/systemd/system/'` on all PUT requests. Return 403 with a clear message: "Unit file is not in /etc/systemd/system/ — editing package-managed files is not allowed." The GET endpoint should return `writable: false` for such files so the UI can hide/disable the Edit button.
**Warning signs:** `apt upgrade` overwrites admin edits to package-managed unit files; next upgrade wipes changes silently.

### Pitfall 3: fs.rename() is not atomic across filesystems
**What goes wrong:** Temp file written to `/tmp`, then `rename('/tmp/foo', '/etc/systemd/system/bar')` fails with `EXDEV: cross-device link not permitted` on systems where `/tmp` is tmpfs and `/etc` is ext4.
**Why it happens:** `rename(2)` syscall requires source and destination on the same filesystem.
**How to avoid:** Always write the temp file to the same directory as the destination: `join(dirname(destPath), '.tmp-' + basename(destPath) + '.' + suffix)`. Confirmed: `/etc/systemd/system/` and `/etc` are on the same filesystem on this host.
**Warning signs:** `rename` throws `EXDEV`; alternatively, file may be silently truncated on power loss if not using rename.

### Pitfall 4: daemon-reload called with a service name argument
**What goes wrong:** `runSystemctl('daemon-reload', 'cron.service')` fails because `daemon-reload` doesn't accept a unit name.
**Why it happens:** `runSystemctl` appends `serviceName` to args if it's non-null: `args = ['--no-pager', 'daemon-reload', 'cron.service']`. systemctl returns an error.
**How to avoid:** Always call `runSystemctl('daemon-reload', null)` — explicitly pass `null` for the service name. The `runSystemctl` function skips appending it when null.
**Warning signs:** `systemctl` exits with `Failed to reload daemon: Access denied` or `No such unit`.

### Pitfall 5: daemon-reload not in ALLOWED_ACTIONS
**What goes wrong:** `runSystemctl('daemon-reload', null)` throws `Error: Blocked systemctl action: "daemon-reload"` before any systemctl call is made.
**Why it happens:** `exec.js` enforces a whitelist; `daemon-reload` is not in the current list.
**How to avoid:** Add `'daemon-reload'` to `ALLOWED_ACTIONS` in `server/utils/exec.js` as part of this phase.
**Warning signs:** Route handler always returns 500 with `Blocked systemctl action: "daemon-reload"`.

### Pitfall 6: CodeMirror extension recreated on each render
**What goes wrong:** The editor flickers or loses cursor position on every keystroke.
**Why it happens:** `extensions={[StreamLanguage.define(properties)]}` inside the component creates a new extension instance on every render, causing CodeMirror to reinitialize.
**How to avoid:** Define the language extension at module level: `const systemdLang = StreamLanguage.define(properties)`. Pass the constant to `extensions={[systemdLang]}`.
**Warning signs:** Editor cursor jumps to position 0 after every character typed.

### Pitfall 7: path.resolve() vs path.join() for traversal prevention
**What goes wrong:** `path.join('/etc/systemd/system/', '../../../etc/passwd')` = `/etc/passwd` which passes a naive `.startsWith('/etc/systemd/system/')` check because the join result doesn't collapse `..` sequences.
**Actually:** `path.resolve('/etc/systemd/system/', '../../../etc/passwd')` = `/etc/passwd` — collapses correctly. But `path.join` does NOT collapse `..` when the first segment is absolute.
**How to avoid:** Use `path.resolve(fragmentPath)` (no second argument) to canonicalize. The `FragmentPath` from `systemctl show` is already absolute so `resolve` is deterministic. Then check the resolved path against allowed prefixes.
**Warning signs:** Penetration test: `curl -X PUT /api/unit/../../../../etc/passwd` succeeds.

### Pitfall 8: Content-Type validation on PUT body
**What goes wrong:** A client sends JSON `{ "content": null }` or a non-string value and `writeFile(tmpPath, null)` creates a file with the string `"null"`.
**Why it happens:** `express.json()` parses the body; if `content` is missing or wrong type, server writes whatever it received.
**How to avoid:** Validate `typeof content === 'string' && content.length > 0` before any file I/O. Return 400 if invalid.
**Warning signs:** Unit file contains the literal text `"null"` or `"undefined"` after a bad save; `daemon-reload` then fails.

---

## Code Examples

### Full GET /api/unit/:service endpoint skeleton
```javascript
// Source: verified patterns from project codebase + Node.js docs
router.get('/:service', async (req, res, next) => {
  try {
    const { service } = req.params
    if (!SERVICE_NAME_RE.test(service)) {
      return res.status(400).json({ ok: false, error: 'Invalid service name' })
    }

    const fragmentPath = await getFragmentPath(service)
    if (!fragmentPath) {
      return res.status(404).json({ ok: false, error: 'Unit file path not found' })
    }
    if (!validatePath(fragmentPath, READ_PREFIXES)) {
      return res.status(403).json({ ok: false, error: 'Unit file path not allowed' })
    }

    const content = await readFile(resolve(fragmentPath), 'utf8')
    const writable = resolve(fragmentPath).startsWith(WRITE_PREFIX)

    return res.json({ ok: true, service, path: fragmentPath, content, writable })
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ ok: false, error: 'Unit file not found on disk' })
    }
    next(err)
  }
})
```

### Full PUT /api/unit/:service endpoint skeleton
```javascript
// Source: verified atomic write pattern; confirmed /etc and /tmp on same partition on this host
router.put('/:service', async (req, res, next) => {
  try {
    const { service } = req.params
    const { content } = req.body

    if (!SERVICE_NAME_RE.test(service)) {
      return res.status(400).json({ ok: false, error: 'Invalid service name' })
    }
    if (typeof content !== 'string' || content.length === 0) {
      return res.status(400).json({ ok: false, error: 'content must be a non-empty string' })
    }
    if (content.length > 1_000_000) {
      return res.status(400).json({ ok: false, error: 'content too large' })
    }

    const fragmentPath = await getFragmentPath(service)
    if (!fragmentPath) {
      return res.status(404).json({ ok: false, error: 'Unit file path not found' })
    }

    const destPath = resolve(fragmentPath)
    if (!destPath.startsWith(WRITE_PREFIX)) {
      return res.status(403).json({
        ok: false,
        error: 'Only files in /etc/systemd/system/ can be edited',
      })
    }

    // Atomic write: temp file in same directory as destination
    const dir = dirname(destPath)
    const tmpPath = join(dir, '.tmp-' + basename(destPath) + '.' + randomBytes(4).toString('hex'))
    await writeFile(tmpPath, content, { encoding: 'utf8', mode: 0o644 })
    await rename(tmpPath, destPath)

    // daemon-reload only after successful write
    await runSystemctl('daemon-reload', null)

    return res.json({ ok: true, service, path: fragmentPath })
  } catch (err) {
    next(err)
  }
})
```

### TypeScript type for unit file response
```typescript
// src/types/unit.ts (new file)
export interface UnitFileInfo {
  service: string
  path: string        // FragmentPath — e.g. /etc/systemd/system/nginx.service
  content: string     // Full text of the unit file
  writable: boolean   // true only if path is under /etc/systemd/system/
}
```

### CodeMirror integration in UnitFile.tsx
```tsx
import CodeMirror from '@uiw/react-codemirror'
import { StreamLanguage } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'

// Module-level constant — NOT inside the component
const systemdLang = StreamLanguage.define(properties)

function UnitEditor({ content, onChange }: { content: string; onChange: (val: string) => void }) {
  return (
    <CodeMirror
      value={content}
      height="100%"
      theme="dark"
      extensions={[systemdLang]}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
      }}
    />
  )
}
```

### exec.js ALLOWED_ACTIONS update
```javascript
// Source: server/utils/exec.js — add 'daemon-reload' to existing freeze
export const ALLOWED_ACTIONS = Object.freeze([
  'start', 'stop', 'restart', 'enable', 'disable',
  'status', 'is-active', 'is-enabled', 'show', 'list-units',
  'daemon-reload',  // Phase 5: needed by unit file writer
])
```

### Adding unit file link to ServiceRow
```tsx
// src/components/ServiceRow.tsx — import FileCode from lucide-react
import { FileCode } from 'lucide-react'

// Inside the actions cell, after the ScrollText logs link:
<Link
  to={`/unit/${encodeURIComponent(service.unit)}`}
  title="View Unit File"
  className="p-1 rounded hover:bg-bg-elevated text-text-muted hover:text-accent transition-colors"
>
  <FileCode className="w-3.5 h-3.5" />
</Link>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `systemctl cat <service>` to read unit file | `systemctl show -p FragmentPath` + `fs.readFile` | Established pattern | `systemctl cat` includes drop-in overrides and formats output for humans; `FragmentPath` gives the actual file path for structured I/O |
| Direct `fs.writeFile` to target | Temp file + `fs.rename` in same dir | Best practice (POSIX) | Atomic: no window where the file is empty or partially written |
| CodeMirror 5 (legacy) | CodeMirror 6 via `@uiw/react-codemirror` | 2021 | CM6 is modular, tree-sitter backed, and actively maintained; CM5 is in maintenance mode |
| Monaco Editor for browser code editing | CodeMirror 6 for admin tools | 2020+ | Monaco needs web worker setup in Vite; CM6 is simpler to configure and smaller |

**Deprecated/outdated:**
- `systemctl cat`: Outputs human-readable format with `# /path/to/file` headers and drop-in overlays — not suitable as the source for the writable unit file content.
- CodeMirror 5 modes directly: Available modes for CM5 are not compatible with CM6 natively; use the `@codemirror/legacy-modes` bridge.

---

## Open Questions

1. **Edit button availability when `writable: false`**
   - What we know: Files in `/usr/lib/systemd/system/` cannot be safely edited in place. The GET endpoint returns `writable: false` for these.
   - What's unclear: Should the Edit button be hidden, shown grayed out, or not shown at all? The phase success criteria say "clicking edit opens the unit file in a code editor" — this implies Edit is accessible. For non-writable files, showing a grayed button with a tooltip "This is a package-managed file and cannot be edited" is the clearest UX.
   - Recommendation: Show the Edit button; disable it with `disabled` attribute and tooltip when `writable === false`. Planner's choice.

2. **Navigation entry point for Unit File page**
   - What we know: The Layout sidebar currently has: Services, Logs, Settings. The Settings nav item is a placeholder going to `/settings` (hits the `*` catch-all ComingSoon page).
   - What's unclear: Should the sidebar get a "Unit Files" item? Or is the unit file accessed only from the ServiceRow icon? The phase description says "a service's unit file tab" — this suggests navigation from the service row, not from the sidebar.
   - Recommendation: Add a `FileCode` icon link in ServiceRow (alongside the existing ScrollText logs link) as the primary entry point. Keep the sidebar as-is unless the planner wants to add a top-level "Unit" nav item. Either approach is valid.

3. **save/cancel UX when content is unchanged**
   - What we know: If the user clicks Edit and then immediately clicks Save without changing anything, the server will write the identical content and run daemon-reload unnecessarily.
   - What's unclear: Should the save button be disabled when content is unchanged? This requires a comparison between `originalContent` and `editContent`.
   - Recommendation: Track `originalContent` as a ref or state; disable Save button when `editContent === originalContent`. This is a minor UX touch; planner can include or skip.

4. **systemd-analyze verify before saving**
   - What we know: STATE.md has a research flag: "systemd-analyze verify behavior on different unit file types should be validated during Phase 5 implementation." `systemd-analyze verify <unit-file>` can catch syntax errors before daemon-reload.
   - What's unclear: Running `systemd-analyze verify` requires adding it to a new exec wrapper or adding the binary to ALLOWED_ACTIONS (it's not `systemctl`). It's a separate binary at `/usr/bin/systemd-analyze`.
   - Recommendation: Defer `systemd-analyze verify` to a future enhancement. UNIT-03 only requires "writes the change to disk atomically and triggers `systemctl daemon-reload` automatically" — not pre-save validation. Including it now adds complexity without a corresponding requirement.

5. **Content size limit**
   - What we know: Unit files are small (typically under 2KB). The 1MB limit in the PUT handler is very conservative.
   - What's unclear: Is there a meaningful upper bound to enforce at the UI level too?
   - Recommendation: 1MB server-side limit is sufficient. No UI-side size check needed.

---

## Sources

### Primary (HIGH confidence)
- Project codebase read — `server/utils/exec.js`, `server/routes/services.js`, `server/routes/logs.js`, `server/utils/systemctl.js`, `server/index.js`, `src/App.tsx`, `src/components/ServiceRow.tsx`, `src/components/Layout.tsx`, `src/pages/Logs.tsx`, `src/index.css`, `package.json`
- Verified locally — `systemctl show -p FragmentPath docusaurus.service` returns `/etc/systemd/system/docusaurus.service` (custom service); `cron.service` returns `/usr/lib/systemd/system/cron.service` (package-managed)
- Verified locally — `/etc/systemd/system/` and `/tmp` are on the same filesystem (`/dev/sda1`); `fs.rename` is atomic within this partition
- Verified locally — Node.js `path.resolve('/etc/systemd/system/../../../etc/passwd')` collapses to `/etc/passwd` correctly
- Verified locally — `systemctl daemon-reload` exists and is documented: "Reload systemd manager configuration"
- npm registry — `@uiw/react-codemirror@4.25.4` peerDeps `react: >=17.0.0`; satisfies React 19.2.0
- npm registry — `@codemirror/legacy-modes@6.5.2`, `@codemirror/language@6.12.1` — current stable versions
- lucide-react installed version — confirmed icon availability: `file-code.js`, `edit.js`, `save.js`, `x.js`, `check.js` all present

### Secondary (MEDIUM confidence)
- WebFetch github.com/codemirror/legacy-modes — `properties.js` mode confirmed to exist in `/mode/` directory; handles `[Section]` headers and `key=value` pairs; export name is `properties`; import path is `@codemirror/legacy-modes/mode/properties`
- WebFetch ahmadrosid.com — confirmed exact import pattern: `import { nginx } from "@codemirror/legacy-modes/mode/nginx"` and `StreamLanguage.define(nginx)` — same pattern applies to `properties`
- WebSearch — `@uiw/react-codemirror` is the standard React wrapper for CodeMirror 6 (1.8M weekly downloads); not an obscure library

### Tertiary (LOW confidence)
- Bundle size estimate for CodeMirror 6 + @uiw/react-codemirror: approximately 400-500KB minified, ~150KB gzipped (cited in WebSearch results but not directly verified against this version). Monaco is documented at ~5MB. Relative comparison is reliable even if exact figures are approximate.

---

## Metadata

**Confidence breakdown:**
- Path resolution via FragmentPath: HIGH — tested live on this system with real services
- Atomic write pattern (temp+rename): HIGH — verified on this host; standard POSIX pattern
- daemon-reload via runSystemctl: HIGH — confirmed `daemon-reload` accepts no service name; exec.js null-handling verified in code
- `properties` mode for INI syntax: MEDIUM-HIGH — mode confirmed to exist; handles `[Section]` + `key=value`; not tested end-to-end in this project yet
- @uiw/react-codemirror API: MEDIUM — API shape confirmed via multiple sources; not installed and tested in this project yet
- React 19 compat with @uiw/react-codemirror: HIGH — peerDep `>=17.0.0` verified from npm registry

**Research date:** 2026-02-21
**Valid until:** 2026-08-21 (stable: POSIX fs semantics, systemd FragmentPath, CodeMirror 6 APIs; @uiw packages follow semver — minor/patch updates are backward compatible)
