---
status: resolved
trigger: "syntax highlighting not showing in unit file read-only viewer"
created: 2026-02-21T00:00:00Z
updated: 2026-02-21T00:00:00Z
---

## Current Focus

hypothesis: Read-only view uses a plain <pre> tag with no syntax highlighting; CodeMirror is only mounted in edit mode
test: Read src/pages/UnitFile.tsx and check how each mode renders
expecting: Read-only = plain <pre>, edit = CodeMirror
next_action: Document root cause and suggest fix

## Symptoms

expected: [Section] headers and Key=Value pairs should have different colors in the read-only viewer
actual: Everything is plain monochrome text in read-only mode
errors: none
reproduction: Open any unit file in systemdctl; observe the read-only view has no highlighting
started: Always — read-only view was never wired to CodeMirror

## Eliminated

(none needed — root cause was immediately apparent)

## Evidence

- timestamp: 2026-02-21
  checked: src/pages/UnitFile.tsx lines 189-194 (read-only view)
  found: Read-only view is a bare `<pre>` tag that renders `{unitInfo.content}` as plain text. No syntax highlighting library, no CodeMirror, no token parsing.
  implication: This is the direct cause — there is simply no highlighting code in the read-only path.

- timestamp: 2026-02-21
  checked: src/pages/UnitFile.tsx lines 197-212 (edit view)
  found: Edit view uses `<CodeMirror>` with `extensions={[systemdLang]}` where `systemdLang = StreamLanguage.define(properties)`. This correctly applies the properties/INI language mode.
  implication: The highlighting infrastructure already exists (CodeMirror + properties mode) but is only used in edit mode.

## Resolution

root_cause: The read-only view (lines 191-193) renders unit file content inside a plain `<pre>` tag with no syntax highlighting. CodeMirror with the properties language mode is only instantiated for the edit view. The read-only view never passes through any tokenizer.
fix: Replace the plain `<pre>` block with a read-only CodeMirror instance that uses the same `systemdLang` extension.
verification: pending
files_changed:
  - src/pages/UnitFile.tsx
