---
status: complete
phase: 05-unit-file-editor
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md
started: 2026-02-21T14:20:00Z
updated: 2026-02-21T14:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. FileCode link in service list
expected: Each service row in the dashboard shows a file icon (FileCode) link next to the existing logs (ScrollText) icon. The icon links to /unit/:service.
result: pass

### 2. Navigate to unit file page
expected: Clicking the file icon on a service row navigates to /unit/:service. The page loads showing the service name, the resolved file path, and the unit file content.
result: pass

### 3. Syntax highlighting in viewer
expected: The unit file content displays with visual distinction — [Section] headers and Key=Value pairs are syntax-highlighted (different colors/styles), not plain monochrome text.
result: issue
reported: "not seeing syntax-highlighted (different colors/styles)"
severity: minor

### 4. Edit button gating (writable file)
expected: For a service whose unit file lives in /etc/systemd/system/, the Edit button is enabled and clickable.
result: pass

### 5. Edit button gating (read-only file)
expected: For a package-managed service (unit file in /usr/lib/systemd/system/ or similar), the Edit button is disabled with a tooltip explaining the file is not editable.
result: pass

### 6. Edit mode with CodeMirror
expected: Clicking Edit on a writable file switches the view to a CodeMirror editor with the file content loaded, syntax-highlighted, and editable.
result: pass

### 7. Save changes
expected: After editing content in the editor, clicking Save sends the changes. A success message appears and the Save button disables (content matches saved state). The daemon-reload is triggered automatically.
result: issue
reported: "EACCES: permission denied, open '/etc/systemd/system/.tmp-docusaurus.service.fbd484ce'"
severity: blocker

## Summary

total: 7
passed: 5
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Unit file content displays with syntax highlighting — different colors for [Section] headers and Key=Value pairs"
  status: failed
  reason: "User reported: not seeing syntax-highlighted (different colors/styles)"
  severity: minor
  test: 3
  artifacts: []
  missing: []
- truth: "Save writes content atomically and triggers daemon-reload"
  status: failed
  reason: "User reported: EACCES: permission denied, open '/etc/systemd/system/.tmp-docusaurus.service.fbd484ce'"
  severity: blocker
  test: 7
  artifacts: []
  missing: []
- truth: "Service list should visually distinguish editable (/etc/systemd/system/) from system-managed services"
  status: failed
  reason: "User reported: no way to differentiate user-created services from system-managed ones in the service list"
  severity: minor
  test: 4
  artifacts: []
  missing: []
