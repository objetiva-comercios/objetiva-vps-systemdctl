import { resolve } from 'node:path'
import express from 'express'
import { runSystemctl } from '../utils/exec.js'
import { getAllServices, parseShowOutput } from '../utils/systemctl.js'
import db from '../db.js'

const router = express.Router()

const SHOW_PROPS =
  'Id,Description,MainPID,MemoryCurrent,CPUUsageNSec,ActiveEnterTimestamp,ActiveState,LoadState,SubState,UnitFileState,FragmentPath'

const ALLOWED_DASHBOARD_ACTIONS = ['start', 'stop', 'restart', 'enable', 'disable']

/**
 * GET /api/services
 * Returns all systemd services with merged list-units + show data.
 */
router.get('/', async (req, res, next) => {
  try {
    const services = await getAllServices()
    res.json({ ok: true, services })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/services/:name/action
 * Body: { action: 'start' | 'stop' | 'restart' | 'enable' | 'disable' }
 * Executes the systemctl command through the exec.js wrapper and returns updated service state.
 *
 * - Invalid action names return 400
 * - Invalid service names are rejected by exec.js (throws Error)
 */
router.post('/:name/action', async (req, res, next) => {
  try {
    const { name } = req.params
    const { action } = req.body

    if (!ALLOWED_DASHBOARD_ACTIONS.includes(action)) {
      return res.status(400).json({ ok: false, error: `Invalid action: "${action}"` })
    }

    // Execute action — exec.js validates service name and whitelisted actions
    const result = await runSystemctl(action, name)

    // Re-fetch updated state for this single service
    const showResult = await runSystemctl('show', name, ['-p', SHOW_PROPS])
    const detailMap = parseShowOutput(showResult.stdout)
    const detail = detailMap.get(name) ?? {}

    const isWatched = !!db.prepare('SELECT 1 FROM watched_services WHERE unit = ?').get(name)

    res.json({
      ok: result.ok,
      stderr: result.stderr || undefined,
      service: {
        unit: name,
        load: detail.LoadState ?? '',
        active: detail.ActiveState ?? '',
        sub: detail.SubState ?? '',
        description: detail.Description ?? '',
        unitFileState: detail.UnitFileState ?? '',
        pid: detail.MainPID && detail.MainPID !== '0' ? parseInt(detail.MainPID, 10) : null,
        memoryBytes:
          detail.MemoryCurrent && detail.MemoryCurrent !== '[not set]'
            ? parseInt(detail.MemoryCurrent, 10)
            : null,
        cpuNsec:
          detail.CPUUsageNSec && detail.CPUUsageNSec !== '[not set]'
            ? parseInt(detail.CPUUsageNSec, 10)
            : null,
        activeEnterTimestamp: detail.ActiveEnterTimestamp || null,
        isWatched,
        fragmentPath: detail.FragmentPath || null,
        writable: detail.FragmentPath ? resolve(detail.FragmentPath).startsWith('/etc/systemd/system/') : false,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
