---
status: resolved
trigger: "Saving a unit file fails with EACCES permission denied"
created: 2026-02-21T03:15:00Z
updated: 2026-02-21T03:20:00Z
---

## Current Focus

hypothesis: CONFIRMED - Node.js writeFile directly to /etc/systemd/system/ fails because server runs as unprivileged user (sanchez) and directory is root-owned (0755)
test: verified directory permissions and exec.js pattern
expecting: N/A - root cause confirmed
next_action: document fix recommendation

## Symptoms

expected: PUT /api/unit/:service should save the edited unit file content to /etc/systemd/system/
actual: EACCES permission denied when creating temp file in /etc/systemd/system/
errors: "EACCES: permission denied, open '/etc/systemd/system/.tmp-docusaurus.service.fbd484ce'"
reproduction: PUT /api/unit/docusaurus.service with valid content body
started: always broken - this is a design gap in the write implementation

## Eliminated

(none needed - root cause was obvious from first evidence gathering)

## Evidence

- timestamp: 2026-02-21T03:16:00Z
  checked: /etc/systemd/system/ permissions
  found: drwxr-xr-x root:root (0755) - only root can write
  implication: Any non-root process cannot create files here

- timestamp: 2026-02-21T03:16:00Z
  checked: server process user
  found: runs as uid=1002(sanchez), groups include sudo but that requires password
  implication: Server has no write access to /etc/systemd/system/

- timestamp: 2026-02-21T03:17:00Z
  checked: server/routes/unit.js PUT handler (lines 112-116)
  found: Uses Node.js fs writeFile() and rename() directly - no privilege escalation
  implication: Direct fs calls inherit the process UID permissions - will always fail as non-root

- timestamp: 2026-02-21T03:17:00Z
  checked: server/utils/exec.js runSystemctl()
  found: Calls /usr/bin/systemctl via execFile() without sudo - relies on polkit/D-Bus for privilege
  implication: systemctl start/stop/restart work because systemctl talks to systemd via D-Bus and polkit authorizes the user. File I/O has no such mechanism.

- timestamp: 2026-02-21T03:18:00Z
  checked: polkit policy existence
  found: /usr/share/polkit-1/actions/org.freedesktop.systemd1.policy exists
  implication: systemctl commands (start/stop/enable/disable/daemon-reload) go through D-Bus->polkit which can grant access. But writing files is raw filesystem I/O with no polkit path.

## Resolution

root_cause: The PUT /api/unit/:service handler uses Node.js fs.writeFile() and fs.rename() to write directly to /etc/systemd/system/. This directory is owned by root:root with 0755 permissions. The server runs as unprivileged user "sanchez". Unlike systemctl commands (start/stop/restart/daemon-reload) which work through D-Bus and polkit for privilege escalation, raw filesystem writes have no such mechanism. The atomic write pattern (temp file + rename) fails at the very first step: creating the temp file in the root-owned directory.

fix: Replace direct fs.writeFile()/rename() with a child process call that uses privilege escalation, consistent with how the rest of the app handles privileged operations. The recommended approach is to shell out to a helper that writes the file with elevated privileges, using the same execFile() pattern as runSystemctl().

verification: N/A - documenting fix approach

files_changed: []
