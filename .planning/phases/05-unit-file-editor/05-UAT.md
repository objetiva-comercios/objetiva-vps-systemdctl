---
status: complete
phase: 05-unit-file-editor
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md
started: 2026-02-21T14:10:00Z
updated: 2026-02-21T14:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. FileCode link in service list
expected: Each service row in the dashboard shows a file icon (FileCode) link next to the existing logs (ScrollText) icon. The icon links to /unit/:service.
result: issue
reported: "icono View unit files --> me da este error : Unexpected token '<', \"<!doctype \"... is not valid JSON"
severity: blocker

### 2. Navigate to unit file page
expected: Clicking the file icon on a service row navigates to /unit/:service. The page loads showing the service name, the resolved file path, and the unit file content.
result: issue
reported: "navigates to /unit/apparmor.service correctly, page shows service name but then error: Unexpected token '<', \"<!doctype \"... is not valid JSON — API returns HTML instead of JSON"
severity: blocker

### 3. Syntax highlighting in viewer
expected: The unit file content displays with visual distinction — [Section] headers and Key=Value pairs are syntax-highlighted (different colors/styles), not plain monochrome text.
result: skipped
reason: blocked by API error — page never loads content

### 4. Edit button gating (writable file)
expected: For a service whose unit file lives in /etc/systemd/system/, the Edit button is enabled and clickable.
result: skipped
reason: blocked by API error — page never loads content

### 5. Edit button gating (read-only file)
expected: For a package-managed service (unit file in /usr/lib/systemd/system/ or similar), the Edit button is disabled with a tooltip explaining the file is not editable.
result: skipped
reason: blocked by API error — page never loads content

### 6. Edit mode with CodeMirror
expected: Clicking Edit on a writable file switches the view to a CodeMirror editor with the file content loaded, syntax-highlighted, and editable.
result: skipped
reason: blocked by API error — page never loads content

### 7. Save changes
expected: After editing content in the editor, clicking Save sends the changes. A success message appears and the Save button disables (content matches saved state). The daemon-reload is triggered automatically.
result: skipped
reason: blocked by API error — page never loads content

## Summary

total: 7
passed: 0
issues: 2
pending: 0
skipped: 5

## Gaps

- truth: "FileCode icon in service row links to /unit/:service and page loads correctly"
  status: failed
  reason: "User reported: icono View unit files --> me da este error : Unexpected token '<', \"<!doctype \"... is not valid JSON"
  severity: blocker
  test: 1
  artifacts: []
  missing: []
- truth: "Unit file page loads showing service name, file path, and file content"
  status: failed
  reason: "User reported: navigates to /unit/apparmor.service correctly, page shows service name but then error: Unexpected token '<', \"<!doctype \"... is not valid JSON — API returns HTML instead of JSON"
  severity: blocker
  test: 2
  artifacts: []
  missing: []
