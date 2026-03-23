# Phase 6: Service Action Response Fix - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the POST /api/services/:name/action response to include `fragmentPath` and `writable` fields, matching the shape returned by GET /api/services. This prevents the "user" badge from disappearing after start/stop/restart/enable/disable actions until the next poll cycle.

Gap closure for INT-01 (action response missing fields) and FLOW-01 (badge flicker after action) from v1.0 milestone audit.

</domain>

<decisions>
## Implementation Decisions

### Response completeness
- Add ONLY `fragmentPath` and `writable` to the action response — no other fields are missing
- All other 11 fields (unit, load, active, sub, description, unitFileState, pid, memoryBytes, cpuNsec, activeEnterTimestamp, isWatched) already match between GET and POST responses
- Add `FragmentPath` to `SHOW_PROPS` constant in `server/routes/services.js` so it's fetched in the same `systemctl show` call (no extra process spawn)
- Derive `writable` using same logic as `server/utils/systemctl.js:107`: `resolve(FragmentPath).startsWith('/etc/systemd/system/')`

### Claude's Discretion
- Whether to extract the service object construction into a shared helper (DRY) or keep it inline in both routes
- Any minor refactoring needed to avoid duplicating the writable derivation logic

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — Action endpoint
- `server/routes/services.js` — POST /:name/action handler (lines 34-79) where fragmentPath/writable must be added
- `server/routes/services.js:8-9` — SHOW_PROPS constant missing FragmentPath

### Backend — Reference implementation (correct shape)
- `server/utils/systemctl.js:86-110` — getAllServices() already returns fragmentPath+writable correctly; this is the reference shape

### Frontend — Optimistic update consumer
- `src/pages/Home.tsx:23-24` — handleServiceUpdate replaces full entry with action response data
- `src/components/ServiceRow.tsx:96-103` — writable badge rendering that breaks when field is missing
- `src/types/service.ts:13-14` — ServiceEntry type includes fragmentPath and writable

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `resolve` from `node:path` already imported in `systemctl.js` — needed for writable derivation
- `SHOW_PROPS` constant is the single place to add `FragmentPath`

### Established Patterns
- `detail.FragmentPath || null` pattern used in `systemctl.js:106` — same null-guard for missing values
- `resolve(detail.FragmentPath).startsWith('/etc/systemd/system/')` pattern in `systemctl.js:107` — exact writable derivation logic

### Integration Points
- `handleServiceUpdate(updated)` in Home.tsx receives the full `service` object from action response — no frontend changes needed if backend returns complete shape
- `ServiceEntry` TypeScript type already expects `fragmentPath: string | null` and `writable: boolean`

</code_context>

<specifics>
## Specific Ideas

- Fix is backend-only: add 2 fields to the action response object in services.js
- Frontend already handles these fields correctly — the bug is purely that the backend doesn't send them
- No new dependencies, no new files, no new routes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-service-action-response-fix*
*Context gathered: 2026-03-23*
