import express from 'express'
import os from 'node:os'

const router = express.Router()

/**
 * GET /api/system
 * Returns hostname and system uptime in seconds.
 */
router.get('/', (req, res) => {
  res.json({
    ok: true,
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(os.uptime()),
  })
})

export default router
