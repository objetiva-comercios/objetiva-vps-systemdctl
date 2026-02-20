import Database from 'better-sqlite3'
import { DB_PATH } from './config.js'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

// Ensure data directory exists before opening the database
mkdirSync(dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export default db
