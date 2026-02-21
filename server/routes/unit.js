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

/**
 * Validate that a file path is under one of the allowed prefixes.
 * Uses resolve() to collapse ../ traversal before prefix check.
 * @param {string} filePath
 * @param {string[]} prefixes
 * @returns {boolean}
 */
function validatePath(filePath, prefixes) {
  const resolved = resolve(filePath)
  return prefixes.some(p => resolved.startsWith(p))
}

/**
 * Resolve the on-disk path of a unit file via systemctl show -p FragmentPath.
 * Returns null if the unit is not loaded or has no fragment path.
 * @param {string} service
 * @returns {Promise<string|null>}
 */
async function getFragmentPath(service) {
  const result = await runSystemctl('show', service, ['-p', 'FragmentPath'])
  // Output: "FragmentPath=/etc/systemd/system/nginx.service"
  const line = result.stdout.split('\n').find(l => l.startsWith('FragmentPath='))
  if (!line) return null
  const path = line.slice('FragmentPath='.length).trim()
  return path || null
}

// GET /api/unit/:service
// Returns { ok, service, path, content, writable }
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

// PUT /api/unit/:service
// Body: { content: string }
// Writes atomically (temp+rename same-dir) and triggers daemon-reload
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

    // Content size guard: systemd unit files should never be larger than 1MB
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

    // Atomic write: temp file in same directory as destination (same filesystem guaranteed)
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

export default router
