import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PORT, HOST } from './config.js'
import servicesRouter from './routes/services.js'
import systemRouter from './routes/system.js'
import watchedRouter from './routes/watched.js'

// ESM __dirname replacement
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, '..', 'dist')

// Initialize database on startup (side-effect import)
import './db.js'

const app = express()

// 1. JSON body parser middleware
app.use(express.json())

// 2. API routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

app.use('/api/services', servicesRouter)
app.use('/api/system', systemRouter)
app.use('/api/watched', watchedRouter)

// 3. Error handling middleware (registered after all API routes, before static serving)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status ?? 500
  res.status(status).json({
    ok: false,
    error: err.message ?? 'Internal server error',
    details: err.details ?? undefined,
  })
})

// 4. Serve static files from dist/ — index: false so the SPA catch-all handles /
app.use(express.static(DIST, { index: false }))

// 5. SPA catch-all — MUST come after all API routes
// Express 5 requires named wildcard syntax (path-to-regexp v8)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'))
})

// Bind to HOST (127.0.0.1 by default) — INFR-02: never listen on 0.0.0.0
app.listen(PORT, HOST, () => {
  console.log(`systemdctl listening on http://${HOST}:${PORT}`)
})
