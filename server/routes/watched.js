import express from 'express'
import db from '../db.js'

const router = express.Router()

// Wider than exec.js SERVICE_NAME_RE — watched route never calls systemctl,
// and some unit names contain backslash (e.g. systemd-fsck@dev-disk-by\x2dlabel-BOOT.service).
// Per research Pitfall 3.
const UNIT_NAME_RE = /^[\w@\-.:\/\\]+\.service$/

// Prepare statements at module level (not inside handlers) for efficiency
const stmts = {
  add: db.prepare('INSERT OR IGNORE INTO watched_services (unit) VALUES (?)'),
  remove: db.prepare('DELETE FROM watched_services WHERE unit = ?'),
}

/**
 * POST /api/watched/:name
 * Adds a service to the watched list.
 * Returns { ok: true, unit, isWatched: true }
 */
router.post('/:name', (req, res) => {
  const { name } = req.params

  if (!UNIT_NAME_RE.test(name)) {
    return res.status(400).json({ ok: false, error: 'Invalid unit name' })
  }

  stmts.add.run(name)
  return res.json({ ok: true, unit: name, isWatched: true })
})

/**
 * DELETE /api/watched/:name
 * Removes a service from the watched list.
 * Returns { ok: true, unit, isWatched: false }
 */
router.delete('/:name', (req, res) => {
  const { name } = req.params

  if (!UNIT_NAME_RE.test(name)) {
    return res.status(400).json({ ok: false, error: 'Invalid unit name' })
  }

  stmts.remove.run(name)
  return res.json({ ok: true, unit: name, isWatched: false })
})

export default router
