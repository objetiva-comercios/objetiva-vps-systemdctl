import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Locked whitelist — never expand from user input (INFR-03)
export const ALLOWED_ACTIONS = Object.freeze([
  'start',
  'stop',
  'restart',
  'enable',
  'disable',
  'status',
  'is-active',
  'is-enabled',
  'show',
  'list-units',
  'daemon-reload', // Phase 5: needed by unit file writer after save
])

// Matches service names: letters, digits, @, -, _, .
// e.g.: nginx.service, my-app@1.service, app_v2.service  (INFR-04)
export const SERVICE_NAME_RE = /^[\w@\-.]+$/

/**
 * Run a single systemctl command safely.
 * @param {string} action - Must be in ALLOWED_ACTIONS
 * @param {string|null} serviceName - Validated before use; null for list-units
 * @param {string[]} extraArgs - Hardcoded extra flags only, never user-supplied
 * @returns {Promise<{ ok: boolean, stdout: string, stderr: string, code: number|null }>}
 */
export async function runSystemctl(action, serviceName = null, extraArgs = []) {
  // INFR-03: action must be whitelisted
  if (!ALLOWED_ACTIONS.includes(action)) {
    throw new Error(`Blocked systemctl action: "${action}"`)
  }

  // INFR-04: service name validation — reject before any child process call
  if (serviceName !== null && !SERVICE_NAME_RE.test(serviceName)) {
    throw new Error(`Invalid service name: "${serviceName}"`)
  }

  // Build args array — never a shell string
  const args = ['--no-pager', action]
  if (serviceName) args.push(serviceName)
  args.push(...extraArgs)

  try {
    const { stdout, stderr } = await execFileAsync(
      '/usr/bin/systemctl',
      args,
      {
        timeout: 30_000,               // 30 second max
        maxBuffer: 5 * 1024 * 1024,   // 5MB stdout limit
        // shell MUST remain false (default) — never set shell: true
      },
    )
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim(), code: 0 }
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout?.trim() ?? '',
      stderr: err.stderr?.trim() ?? err.message,
      code: err.code ?? null,
    }
  }
}
