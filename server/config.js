import 'dotenv/config'

export const PORT = parseInt(process.env.PORT ?? '7700', 10)
export const HOST = process.env.HOST ?? '127.0.0.1'
export const DB_PATH = process.env.DB_PATH ?? './data/systemdctl.db'
export const NODE_ENV = process.env.NODE_ENV ?? 'development'
