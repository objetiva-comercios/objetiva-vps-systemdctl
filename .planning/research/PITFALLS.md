# Pitfalls Research

**Domain:** systemd admin web panel (Node.js + Express + WebSocket + SQLite)
**Researched:** 2026-02-20
**Confidence:** HIGH (multiple verified sources; most claims confirmed via official Node.js docs, systemd issue tracker, and official library repos)

---

## Critical Pitfalls

### Pitfall 1: journalctl --follow Leaving Zombie Child Processes on WebSocket Disconnect

**What goes wrong:**
When a client closes their browser or disconnects, the WebSocket `close` event fires in Node.js, but the `journalctl --follow` child process spawned for that session continues running. Node.js `child.kill()` sends SIGTERM to the process — but on some systemd versions (pre-fix for issue #9374), journalctl ignores SIGPIPE and does not exit until it tries to write to the now-closed pipe. On older systemd/Ubuntu 18.04, this means the journalctl process could run indefinitely. Even on patched versions, if the kill signal is not sent correctly, zombie processes accumulate silently.

Additionally: Node.js `'exit'` event on a child process fires before stdio streams are closed. If you listen to `'exit'` to do cleanup, stdout may still be readable and the stream reference keeps the process alive in Node.js's event loop.

**Why it happens:**
Developers attach `ws.on('close', () => child.kill())` but forget that:
1. `kill()` defaults to SIGTERM; journalctl may not handle it on older systems
2. The stdout stream of the child process holds an open file descriptor that prevents full cleanup
3. Multiple rapid reconnects can spawn multiple journalctl processes for the same service with no deduplication guard

**How to avoid:**
- Listen to `'close'` (not `'exit'`) on the child process — `close` fires only after stdio streams are fully closed
- Explicitly destroy streams after kill: `child.stdout.destroy()`, `child.stderr.destroy()`
- Use SIGKILL as fallback after a 2-second SIGTERM grace period:
  ```js
  child.kill('SIGTERM');
  const forceKill = setTimeout(() => child.kill('SIGKILL'), 2000);
  child.on('close', () => clearTimeout(forceKill));
  ```
- Keep a `Map<serviceId, ChildProcess>` in the WebSocket handler; kill the previous process before spawning a new one for the same service
- Emit the child process with `{ stdio: ['ignore', 'pipe', 'ignore'] }` — don't open stdin

**Warning signs:**
- `ps aux | grep journalctl` shows processes with no parent (PPID=1) or processes multiplying over time
- Node.js process memory grows steadily without requests increasing
- `MaxListenersExceededWarning` in server logs (a related symptom from event listener accumulation)

**Phase to address:** Phase 3 (WebSocket log streaming implementation)

---

### Pitfall 2: Command Injection via execFile with Shell: True or Argument Injection

**What goes wrong:**
The PRD correctly specifies `execFile` over `exec`. But two residual attack vectors remain even with `execFile`:

1. **Accidentally enabling the shell**: `execFile('systemctl', [action, name], { shell: true })` re-introduces full shell injection. One stray option and the protection evaporates.

2. **Argument injection through valid-looking input**: The regex `/^[\w@\-.]+$/` is good but consider service names like `../../../etc/passwd` — the `@` and `.` characters are allowed, and a name like `foo@.` is a valid systemd template instance syntax. Service names can legitimately contain `@` and `-`, which the regex permits, but path traversal via `../../` would be blocked since `/` is not in the character class. Verify the regex actively rejects slashes and other shell metacharacters, not just "allows only safe chars."

3. **systemctl action whitelist bypass via type coercion**: If the action check is `if (ALLOWED_ACTIONS.includes(req.body.action))` and `req.body.action` is not a string (e.g., `["stop"]`), `Array.prototype.includes` with an array argument may behave unexpectedly. Always `typeof action === 'string'` check before whitelist lookup.

**Why it happens:**
- `{ shell: true }` is sometimes added "to fix an error" without understanding it defeats the point
- Input validation added early can be weakened later by a developer who doesn't understand why it existed
- Copy-paste of shell-based examples from StackOverflow into the exec wrapper

**How to avoid:**
- Enforce `shell: false` (the default) explicitly in the exec wrapper — set it in the options even though it's the default, to make intent clear and prevent future accidental override
- Double-gate actions: `typeof action === 'string' && WHITELIST.has(action)` — use a `Set` not an `Array`
- Write a test that passes an array, object, and null as `action` and asserts rejection
- Add a lint rule or comment: `// DO NOT ADD { shell: true } — this defeats injection protection`
- Use `systemd-run --user` or the D-Bus API for non-root execution in the future; note for now the project runs as root and attack surface is wider

**Warning signs:**
- `shell: true` appearing anywhere in the codebase `grep -r "shell: true"`
- Action parameter not checked for type before whitelist lookup
- Missing test coverage on the exec wrapper's validation logic

**Phase to address:** Phase 1 (exec wrapper and input sanitization) — must be correct from the start

---

### Pitfall 3: Unit File Editor Allowing Symlink Traversal or Overwriting Critical Files

**What goes wrong:**
The `PUT /api/units/:name` endpoint reads a service name from the URL, constructs a path like `/etc/systemd/system/${name}.service`, and writes content there. Attack vectors:

1. **Path traversal**: A name like `../../cron` combined with a path join that doesn't normalize could write to `/etc/cron` instead of `/etc/systemd/system/../../cron`. Even with the regex, if the final path construction is flawed, edge cases exist.

2. **Symlink attack**: An attacker (or a bug) writes a unit file whose name was previously replaced with a symlink pointing elsewhere (e.g., `/etc/systemd/system/myapp.service -> /etc/sudoers`). Then saving via the editor overwrites `/etc/sudoers` with systemd unit content.

3. **Writing to loaded-only paths**: Unit files exist in `/run/systemd/system/` (transient), `/usr/lib/systemd/system/` (distro-provided), and `/etc/systemd/system/` (admin). Writing to the wrong location can silently fail to override or break the system.

4. **Partial write on crash**: Writing a malformed unit file halfway through leaves the file in a state that breaks the service on next start. `systemctl daemon-reload` after a corrupted write can cascade-fail dependent services.

**Why it happens:**
- Path joining with `path.join()` is safe against traversal but `path.resolve()` or string concatenation is not
- Developers trust that the regex on the service name prevents traversal without also validating the final resolved path
- Atomic writes (write to temp file, then rename) are not default behavior in Node.js `fs.writeFile`
- Symlink resolution is not checked before writing

**How to avoid:**
- Always resolve and validate the final path: `const resolved = path.resolve('/etc/systemd/system', name + '.service'); assert(resolved.startsWith('/etc/systemd/system/'))`
- Use `write-file-atomic` (npm) which writes to a temp file then does an atomic `rename()` — prevents partial writes
- Before writing, check if path is a symlink with `fs.lstatSync(resolved)` and refuse to write if `isSymbolicLink()` is true (or resolve the symlink and re-validate the target)
- After writing, run `systemd-analyze verify <path>` via execFile to validate the unit file before daemon-reload — reject and rollback if it fails
- Restrict writes to `/etc/systemd/system/` only — refuse paths in `/usr/lib/` or `/run/`

**Warning signs:**
- Path construction uses string concatenation instead of `path.join` + `path.resolve`
- No check that the resolved path starts with the expected prefix
- No `lstat` / symlink check before write
- `systemd-analyze verify` not called before daemon-reload

**Phase to address:** Phase 2 (unit file editing feature)

---

### Pitfall 4: WebSocket Authentication Bypass (Cross-Site WebSocket Hijacking)

**What goes wrong:**
WebSocket upgrade requests are made by browsers using the `WebSocket()` API. Unlike XHR/Fetch requests, browsers do not enforce CORS on WebSocket upgrades. This means a malicious page at `evil.com` can open a WebSocket to `panel.yourdomain.com` if the server only checks that a session cookie is present. If the WebSocket authentication relies solely on cookies and does not check the `Origin` header, an attacker can hijack the connection from any page the admin visits.

The PRD sends JWT in WebSocket messages (the `{ "service": "..." }` handshake). However, if the JWT check is only done after the socket upgrades (and the upgrade itself is not authenticated), there is a window where the connection is open but unvalidated.

**Why it happens:**
- Developers authenticate REST endpoints with JWT in `Authorization` headers (correct), then apply a different pattern to WebSocket without realizing browser WS cannot send custom headers on initial upgrade
- The `Sec-WebSocket-Key` header looks like security but is only for preventing caching proxy issues, not authentication

**How to avoid:**
- Validate the `Origin` header on WebSocket upgrade: reject connections from origins not in `ALLOWED_ORIGINS`
- Require JWT as a URL query parameter on WebSocket connect: `/ws/logs?token=<jwt>` — validate it before accepting the upgrade
- Do not accept the upgrade until the JWT is verified; close the connection immediately if invalid
- Set `proxy_read_timeout 300` (not `86400`) in nginx for WebSocket — 24-hour timeout means dead connections hold server resources for a full day

**Warning signs:**
- WebSocket upgrade handler does not validate `Origin` header
- JWT validation happens on first message received, not on connection upgrade
- nginx `proxy_read_timeout 86400` without server-side heartbeat + disconnect logic

**Phase to address:** Phase 3 (WebSocket implementation)

---

### Pitfall 5: Rate Limiter Bypassed Due to Incorrect `trust proxy` Configuration

**What goes wrong:**
The PRD specifies rate limiting (5 login attempts → 15-minute block per IP). Behind nginx with `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, the client's real IP is in the `X-Forwarded-For` header. If Express's `trust proxy` is not configured, `req.ip` returns `127.0.0.1` (nginx's IP) for all requests — the rate limiter blocks all users globally after 5 attempts from any source.

Conversely, setting `trust proxy: true` without understanding the header chain means an attacker can spoof any IP by sending `X-Forwarded-For: 1.2.3.4` in their request — effectively bypassing the rate limiter entirely.

**Why it happens:**
- `trust proxy` defaults to `false` in Express; developers add it without reading the security implications
- `express-rate-limit` documentation warns about this but the warning is easy to miss
- nginx config that includes port numbers in X-Forwarded-For (some configurations do `IP:PORT`) means the same IP appears as different identities per request

**How to avoid:**
- Set `app.set('trust proxy', 1)` — exactly 1 hop (nginx is the only proxy)
- Use `express-rate-limit` with a custom `keyGenerator` that uses `req.ip` after trust proxy is correctly set
- Test by adding an endpoint that returns `req.ip` and verify it shows the real client IP
- Do not set `trust proxy: true` (boolean true trusts all proxies in chain — unsafe)
- Consider rate limiting at the nginx level as a second layer: `limit_req_zone` directive

**Warning signs:**
- `req.ip` returns `127.0.0.1` in logs for all requests
- Login rate limiter triggers globally when one IP brute-forces
- `X-Forwarded-For` header can be set by the client and affects rate limiter behavior

**Phase to address:** Phase 1 (auth setup) and Phase 4 (security hardening)

---

### Pitfall 6: JWT Secret Ephemeral or Weak — All Sessions Invalidated on Server Restart

**What goes wrong:**
The PRD allows `JWT_SECRET` to be auto-generated if not provided. If the secret is generated at startup and stored only in memory (not persisted to the DB or `.env`), every server restart invalidates all active JWT tokens. Users get logged out unexpectedly. This is especially painful for the `operator` role checking on long-running deployments.

Separately: storing the JWT access token in `localStorage` (a common React pattern) exposes it to XSS. A single XSS vulnerability in the log viewer (e.g., unsanitized log output rendered as HTML) could exfiltrate all tokens.

**Why it happens:**
- "Auto-generate if missing" is easy to implement but easy to implement incorrectly (memory-only)
- React developers default to `localStorage` because `httpOnly` cookies require more backend coordination
- The log viewer renders arbitrary systemd log output — if rendered with `dangerouslySetInnerHTML` or via a library that doesn't escape, XSS is possible

**How to avoid:**
- Persist the auto-generated JWT secret to the SQLite `config` table on first run; read it from there on subsequent startups
- Store the access token in a `httpOnly` cookie, not `localStorage` — use `SameSite=Strict`; send it via cookie on REST calls
- The refresh token (7-day) must be `httpOnly` cookie only — never expose to JavaScript
- Sanitize all log output before rendering — treat log lines as plain text, never render as HTML
- Log viewer should use `.textContent` not `.innerHTML`

**Warning signs:**
- Server restart causes all users to get 401 errors
- `localStorage.getItem('token')` used for auth in frontend code
- Log viewer component uses `dangerouslySetInnerHTML` or equivalent

**Phase to address:** Phase 1 (auth foundation)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `exec()` instead of `execFile()` | Simpler command construction | Command injection vector; rewrite required | Never — use execFile from day one |
| Polling state every 10s from all clients | Simple to implement | N×10s poll cadence degrades with user count; systemctl called per client | Acceptable for MVP; must consolidate to server-side single poller before multi-user |
| `fs.writeFile()` without atomic rename | Fewer dependencies | Partial writes on crash break services | Never for unit files — always use atomic write |
| SQLite without WAL mode | Zero config | Write serialization starvation under concurrent audit log writes | Never — `PRAGMA journal_mode=WAL` is a one-liner and should be set at DB init |
| JWT in localStorage | Easy frontend implementation | XSS exposes admin credentials | Never for this admin panel — use httpOnly cookie |
| No heartbeat on WebSocket | Less code | Dead connections accumulate; journalctl processes never cleaned up | Never — heartbeat is required for correct cleanup |
| `{ shell: true }` on execFile | "Fixes" argument issues | Re-introduces injection; defeats entire protection | Never |
| Trust proxy: true (boolean) | Quick fix for req.ip | Rate limiter bypassable by any client | Never — use numeric hop count |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `systemctl` via execFile | Forgetting that `systemctl start` blocks until the service start transaction completes (or times out) — for slow-starting services this can hit the 30s timeout | Set timeout to 60s for start actions; report "pending" to UI and poll status separately |
| `journalctl --follow` | Piping through additional filters (`grep`) creates a two-process pipeline where journalctl may not exit when the downstream filter exits | Run journalctl directly without additional pipe stages; do log filtering in Node.js |
| `systemctl daemon-reload` after unit file write | There is a documented race condition: running `daemon-reload` simultaneously with `systemctl start` can deadlock | Run daemon-reload synchronously and wait for its exit before triggering any start/restart |
| `better-sqlite3` WAL mode | Checkpoint starvation: if reads never stop, the WAL file grows unboundedly | Call `db.checkpoint('RESTART')` periodically (e.g., every 1000 writes or on startup) |
| nginx WebSocket proxying | Default `proxy_read_timeout 60s` closes idle WebSocket connections silently | Set `proxy_read_timeout` to match the server heartbeat interval + buffer (e.g., 90s with 30s heartbeat) |
| `execFile` with timeout | `killSignal` defaults to SIGTERM; processes that ignore SIGTERM become zombies after timeout | Set `killSignal: 'SIGKILL'` on the timeout option, or implement the two-stage kill yourself |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-client service list polling | CPU spikes every 10s × N users; systemctl called N times simultaneously | Single server-side polling loop; broadcast state via WebSocket or SSE to all clients | 5+ concurrent users |
| Unbounded journalctl output buffer | Spawning journalctl without `--lines` limit for initial burst; Node.js buffers huge amount before sending | Always pass `--lines N` and `--output cat` to control line volume; enforce highWaterMark | Services with millions of log lines |
| Audit log without WAL mode | INSERT blocks under concurrent reads; response times spike | Enable WAL immediately at DB init: `db.pragma('journal_mode = WAL')` | Any concurrent request load |
| Synchronous bcrypt in request handler | bcrypt with 12 rounds takes ~300ms; if called synchronously in async Express handler it blocks the event loop | bcrypt is already async in `bcryptjs` / `bcrypt` npm — verify async usage, never use `bcrypt.hashSync` in a hot path | Login under any load |
| WebSocket log streams left open | journalctl process count grows monotonically; server OOM eventually | Track active streams per service in a Map; enforce one stream per service | ~50 concurrent log viewers |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not validating Origin on WebSocket upgrade | Cross-site WebSocket hijacking — attacker steals log stream and can trigger service restarts | Validate `req.headers.origin` against `ALLOWED_ORIGINS` whitelist before accepting upgrade |
| Storing JWT in localStorage | XSS in log viewer (unsanitized log output) exfiltrates admin token → full system compromise | httpOnly cookies for access + refresh tokens |
| `alg: 'none'` accepted by JWT verify | Attacker crafts unsigned token with any role claim | Use `jsonwebtoken` with explicit `algorithms: ['HS256']` option in verify — never omit |
| Soft-deleting admin user's JWT on logout without blacklist | Stolen token valid until expiry (1 hour) even after logout | Maintain a small SQLite token blacklist for logged-out tokens; prune entries older than JWT_EXPIRY |
| Writing unit files without validating content type | Binary data or very large payloads written to `/etc/systemd/system/` | Reject content with null bytes; enforce max size (e.g., 64KB); only accept UTF-8 text |
| Running `systemctl enable` on arbitrary user-provided unit names | Could enable attacker-placed unit file if path traversal succeeds | Validate that the unit file exists at the expected path before enabling; cross-check name vs filesystem |
| No Content-Security-Policy header | Inline XSS in React output (e.g., via dangerouslySetInnerHTML in log viewer) | Add strict CSP via helmet: `script-src 'self'`; never use `dangerouslySetInnerHTML` for log content |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No confirmation before `stop` on critical services (nginx, sshd) | Admin accidentally stops their own SSH daemon; loses server access | Require typed confirmation ("type service name to confirm") for `disable` and `stop` on services marked critical |
| Log streaming with no pause or max line cap | Browser tab becomes unresponsive after 50,000 lines | Cap displayed lines at 1,000; auto-scroll with pause-on-scroll; offer "download full log" instead |
| Editor without unsaved-change guard | Admin navigates away mid-edit; loses unit file changes silently | `beforeunload` browser event warning + "You have unsaved changes" banner in editor |
| Showing raw journalctl errors in the UI | "Failed to execute operation: Transport endpoint is not connected" confuses non-technical users | Map known systemd error codes to human-readable messages |
| Auto-refresh list resetting user's filter/sort | Admin filters by "failed" services; refresh resets the view | Keep filter state in URL query params or React state; do not reset UI on background polling |

---

## "Looks Done But Isn't" Checklist

- [ ] **Log streaming:** journalctl process is actually killed when WebSocket disconnects — verify with `ps aux | grep journalctl` during testing
- [ ] **Rate limiting:** `req.ip` shows the real client IP (not `127.0.0.1`) when tested behind nginx — add a `/debug/ip` endpoint in development
- [ ] **Unit file editing:** Saving a deliberately malformed unit file is rejected by `systemd-analyze verify` before daemon-reload is called
- [ ] **JWT secret persistence:** Server restart does not log out all currently logged-in users — test by restarting the server with a live session
- [ ] **WebSocket auth:** Opening `/ws/logs?token=` from a browser devtools on a different origin is rejected with 403 — test the Origin check
- [ ] **WAL mode:** `PRAGMA journal_mode` returns `wal` after DB initialization — verify in the startup log
- [ ] **Zombie process prevention:** After 10 rapid WebSocket connect/disconnect cycles, `ps aux` shows no orphaned journalctl processes
- [ ] **Heartbeat cleanup:** Disconnecting network cable (simulating dead connection) kills the WebSocket within 60s — check that the journalctl process is also killed
- [ ] **Symlink protection:** Attempting to write to a symlinked service file path is rejected with a 400 error
- [ ] **Path traversal:** PUT `/api/units/../../etc/passwd` returns 400 before any filesystem access

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Zombie journalctl processes accumulating | MEDIUM | Restart the Node.js server; implement cleanup in Phase 3; add a `GET /debug/streams` admin endpoint to inspect active streams |
| Corrupted unit file after failed write | HIGH | Keep a backup copy before every write (`unitfile.backup.service`); restore from backup; run `systemctl daemon-reload` |
| JWT secret lost on restart (all users logged out) | LOW | Re-login; fix persistence; document that `.env` or DB must persist across restarts |
| Rate limiter blocking all users (trust proxy misconfigured) | HIGH | Must restart server after fixing `trust proxy` setting; affects all users; test in staging first |
| Service broken by bad unit file edit | HIGH | Restore backup unit file; `systemctl daemon-reload`; `systemctl start service`; audit log should show who made the change |
| XSS token theft via log output | VERY HIGH | Rotate JWT secret (invalidates all sessions); audit which services' logs were viewed; consider systemdctl itself compromised if token was admin |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| journalctl zombie processes | Phase 3 (WebSocket streaming) | `ps aux | grep journalctl` shows 0 after all clients disconnect |
| Command injection via shell option | Phase 1 (exec wrapper) | Code review + grep for `shell: true`; unit tests on exec wrapper |
| Unit file path traversal/symlink | Phase 2 (unit file editing) | Integration test: attempt path traversal; verify 400 response |
| WebSocket cross-site hijacking | Phase 3 (WebSocket implementation) | Test from different origin; confirm upgrade is rejected |
| Rate limiter trust proxy misconfiguration | Phase 1 (auth + rate limit) | Verify `req.ip` returns real IP in dev with nginx |
| JWT secret not persisted | Phase 1 (auth foundation) | Restart server; verify tokens still valid |
| Log viewer XSS | Phase 3 (log viewer frontend) | Render ANSI escape codes and HTML entities as text; CSP header test |
| SQLite without WAL mode | Phase 1 (DB initialization) | `PRAGMA journal_mode` assertion at startup |
| WebSocket heartbeat not implemented | Phase 3 (WebSocket) | Kill network; verify journalctl cleanup within 90s |
| Atomic unit file write | Phase 2 (unit file editing) | Kill process mid-write; verify file is not corrupted |

---

## Sources

- [Node.js Child Process official docs — execFile vs exec, close vs exit events, zombie prevention](https://nodejs.org/api/child_process.html)
- [systemd/systemd issue #9374 — journalctl --follow not exiting after stdout closed (now fixed)](https://github.com/systemd/systemd/issues/9374)
- [nodejs/node issue #46569 — Unrefed child_process inside worker thread becomes zombie](https://github.com/nodejs/node/issues/46569)
- [nodejs/node issue #49631 — Memory leak with ChildProcess stdout](https://github.com/nodejs/node/issues/49631)
- [ws WebSocket library — heartbeat/ping-pong pattern (npm official)](https://www.npmjs.com/package/ws)
- [PortSwigger — Cross-site WebSocket hijacking explained](https://portswigger.net/web-security/websockets/cross-site-websocket-hijacking)
- [express-rate-limit Wiki — Trust proxy troubleshooting](https://github.com/express-rate-limit/express-rate-limit/wiki/Troubleshooting-Proxy-Issues)
- [express-rate-limit issue #234 — Port numbers in X-Forwarded-For bypass rate limiter](https://github.com/nfriedly/express-rate-limit/issues/234)
- [better-sqlite3 performance docs — WAL mode and checkpoint starvation](https://wchargin.com/better-sqlite3/performance.html)
- [SQLite WAL write-ahead logging official docs](https://sqlite.org/wal.html)
- [nodejs-security.com — Command injection in Node.js, execFile best practices](https://www.nodejs-security.com/blog/secure-javascript-coding-practices-against-command-injection-vulnerabilities)
- [write-file-atomic npm package — atomic writes for Node.js](https://github.com/npm/write-file-atomic)
- [42crunch.com — JWT security pitfalls: alg:none, token storage](https://42crunch.com/7-ways-to-avoid-jwt-pitfalls/)
- [systemd/systemd issue #5328 — Race condition between daemon-reload and systemctl start](https://github.com/systemd/systemd/issues/5328)
- [Node.js backpressure in streams — highWaterMark and pipe behavior](https://nodejs.org/en/learn/modules/backpressuring-in-streams)
- [Symlink attacks in privileged file operations — CyberArk research](https://www.cyberark.com/resources/threat-research-blog/follow-the-link-exploiting-symbolic-links-with-ease)
- [Red Hat — systemd unit file permissions and /etc/systemd/system precedence](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/using_systemd_unit_files_to_customize_and_optimize_your_system/)

---
*Pitfalls research for: systemd admin web panel (systemdctl)*
*Researched: 2026-02-20*
