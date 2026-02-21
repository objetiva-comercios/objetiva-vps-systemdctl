import express from 'express'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { SERVICE_NAME_RE } from '../utils/exec.js'

const router = express.Router()
const execFileAsync = promisify(execFile)

const VALID_LINES = /^\d+$/
const VALID_SINCE = {
  '5m': '-5m',
  '15m': '-15m',
  '1h': '-1h',
  '6h': '-6h',
  '1d': '-1d',
}

router.get('/:service', async (req, res, next) => {
  try {
    const { service } = req.params

    // Validate service name
    if (!SERVICE_NAME_RE.test(service)) {
      return res.status(400).json({ ok: false, error: 'Invalid service name' })
    }

    // Validate lines param
    const linesRaw = req.query.lines ?? '100'
    if (!VALID_LINES.test(linesRaw) || parseInt(linesRaw, 10) > 1000) {
      return res.status(400).json({ ok: false, error: 'Invalid lines parameter' })
    }

    // Validate since param (unknown values treated as 'all')
    const sinceKey = req.query.since ?? 'all'

    // Build journalctl args
    const args = ['--no-pager', '-q', '-u', service, '-n', linesRaw, '--output', 'json']
    if (sinceKey !== 'all' && VALID_SINCE[sinceKey]) {
      args.push('--since', VALID_SINCE[sinceKey])
    }

    const { stdout } = await execFileAsync('/usr/bin/journalctl', args, {
      timeout: 15_000,
      maxBuffer: 5 * 1024 * 1024,
    })

    // Guard empty stdout before splitting
    if (stdout.trim() === '') {
      return res.json({ ok: true, service, entries: [] })
    }

    const entries = stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        let parsed
        try {
          parsed = JSON.parse(line)
        } catch {
          return null
        }

        const priority = parsed.PRIORITY !== undefined ? parseInt(parsed.PRIORITY, 10) : 6
        const level = priority <= 3 ? 'error' : priority === 4 ? 'warning' : 'info'

        // Convert __REALTIME_TIMESTAMP from microseconds to milliseconds for JS Date
        let ts = null
        if (parsed.__REALTIME_TIMESTAMP) {
          const ms = parseInt(parsed.__REALTIME_TIMESTAMP, 10) / 1000
          ts = new Date(ms).toISOString()
        }

        // Guard MESSAGE — can be string or Uint8Array (represented as array of numbers in JSON)
        let message = ''
        if (typeof parsed.MESSAGE === 'string') {
          message = parsed.MESSAGE
        } else if (Array.isArray(parsed.MESSAGE)) {
          // Binary message — convert byte array to string
          message = String.fromCharCode(...parsed.MESSAGE)
        }

        const identifier = parsed.SYSLOG_IDENTIFIER ?? parsed._COMM ?? ''

        return { ts, priority, level, identifier, message }
      })
      .filter(Boolean)

    return res.json({ ok: true, service, entries })
  } catch (err) {
    next(err)
  }
})

export default router
