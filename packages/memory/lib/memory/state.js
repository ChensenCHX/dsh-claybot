import { STATE_KEY_WATERMARK } from './types.js'

function rowsOf(result) {
  return (result.results && result.results[0] && result.results[0].rows) || []
}

export async function getState(db, key) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT value_json FROM memory.memory_state WHERE key = $1', [key]))
  if (rows.length === 0) return undefined
  try {
    return JSON.parse(rows[0].value_json)
  } catch {
    return undefined
  }
}

export async function setState(db, key, value) {
  await db.queryParams(
    'memory',
    `INSERT INTO memory.memory_state (key, value_json) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value_json = EXCLUDED.value_json`,
    [key, JSON.stringify(value)],
  )
}

export async function getWatermark(db) {
  const value = await getState(db, STATE_KEY_WATERMARK)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function setWatermark(db, lastAccess) {
  await setState(db, STATE_KEY_WATERMARK, lastAccess)
}
