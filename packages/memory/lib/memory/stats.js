export const HALF_LIVES_MS = { h5m: 300000, h1h: 3600000, h24h: 86400000, h7d: 604800000 }

import { MemoryValidationError } from './validate.js'

export const DEFAULT_DECAY_PARAMS = {
  w5m: 8,
  w1h: 4,
  w24h: 2,
  w7d: 1,
  wTotal: 0.05,
  wRecency: 4,
  recencyHalfLifeMs: HALF_LIVES_MS.h24h,
}

const SETTLE_WINDOW_MS = Number(process.env.MEMORY_SETTLE_WINDOW_MS ?? 600000)
let lastGlobalRecountAt = 0

function rowsOf(result) {
  return (result.results && result.results[0] && result.results[0].rows) || []
}

export function decayFactor(dtMs, halfLifeMs) {
  if (dtMs <= 0) return 1
  return 0.5 ** (dtMs / halfLifeMs)
}

export function settleCounters(row, now) {
  const dt = now - Number(row.countersSettledAt)
  if (dt <= 0) return { cH5m: Number(row.cH5m), c1h: Number(row.c1h), c24h: Number(row.c24h), c7d: Number(row.c7d) }
  return {
    cH5m: Number(row.cH5m) * decayFactor(dt, HALF_LIVES_MS.h5m),
    c1h: Number(row.c1h) * decayFactor(dt, HALF_LIVES_MS.h1h),
    c24h: Number(row.c24h) * decayFactor(dt, HALF_LIVES_MS.h24h),
    c7d: Number(row.c7d) * decayFactor(dt, HALF_LIVES_MS.h7d),
  }
}

export async function getSettledCounters(db, id, now = Date.now()) {
  const rows = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT c_h5m AS "cH5m", c_1h AS "c1h", c_24h AS "c24h", c_7d AS "c7d", counters_settled_at AS "countersSettledAt"
       FROM memory.memory_entries WHERE id = $1`,
      [id],
    ),
  )
  if (rows.length === 0) return null
  const settled = settleCounters(rows[0], now)
  return { c5m: settled.cH5m, c1h: settled.c1h, c24h: settled.c24h, c7d: settled.c7d }
}

export async function touchEntries(db, ids, now = Date.now()) {
  const list = [...new Set((ids || []).map((id) => String(id)))]
  if (list.length === 0) return 0
  const rows = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT id, c_h5m AS "cH5m", c_1h AS "c1h", c_24h AS "c24h", c_7d AS "c7d", counters_settled_at AS "countersSettledAt"
       FROM memory.memory_entries WHERE id = ANY($1::text[])`,
      [list],
    ),
  )
  for (const row of rows) {
    const settled = settleCounters(row, now)
    await db.queryParams(
      'memory',
      `UPDATE memory.memory_entries
       SET c_h5m = $2, c_1h = $3, c_24h = $4, c_7d = $5,
           total_access = total_access + 1, counters_settled_at = $6, last_access = $7
       WHERE id = $1`,
      [row.id, settled.cH5m + 1, settled.c1h + 1, settled.c24h + 1, settled.c7d + 1, now, now],
    )
  }
  return rows.length
}

export async function settleAllCounters(db, now = Date.now()) {
  const result = await db.queryParams(
    'memory',
    `UPDATE memory.memory_entries SET
       c_h5m = c_h5m * CASE WHEN counters_settled_at >= $1 THEN 1 ELSE power(0.5, ($1 - counters_settled_at)::double precision / $2) END,
       c_1h = c_1h * CASE WHEN counters_settled_at >= $1 THEN 1 ELSE power(0.5, ($1 - counters_settled_at)::double precision / $3) END,
       c_24h = c_24h * CASE WHEN counters_settled_at >= $1 THEN 1 ELSE power(0.5, ($1 - counters_settled_at)::double precision / $4) END,
       c_7d = c_7d * CASE WHEN counters_settled_at >= $1 THEN 1 ELSE power(0.5, ($1 - counters_settled_at)::double precision / $5) END,
       counters_settled_at = $1`,
    [now, HALF_LIVES_MS.h5m, HALF_LIVES_MS.h1h, HALF_LIVES_MS.h24h, HALF_LIVES_MS.h7d],
  )
  return Number(result.results && result.results[0] ? result.results[0].rowCount : 0) || 0
}

export async function ensureSettled(db, options = {}) {
  const now = options.now === undefined ? Date.now() : Number(options.now)
  const windowMs = options.windowMs === undefined ? SETTLE_WINDOW_MS : Number(options.windowMs)
  if (options.force !== true && now - lastGlobalRecountAt < windowMs) return false
  await settleAllCounters(db, now)
  lastGlobalRecountAt = now
  return true
}

export function lastGlobalRecount() {
  return lastGlobalRecountAt
}

export async function listScored(db, options) {
  const params = options.params === undefined ? resolveDecayParams() : options.params
  const now = options.now === undefined ? Date.now() : Number(options.now)
  const types = options.types === undefined || options.types.length === 0 ? ['short', 'long', 'persona'] : options.types
  const direction = options.direction === 'cold' ? 'ASC' : 'DESC'
  const rows = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT id, (c_h5m * $1::double precision + c_1h * $2::double precision + c_24h * $3::double precision + c_7d * $4::double precision + total_access * $5::double precision
                  + $6::double precision * CASE WHEN last_access >= $7::bigint THEN 1 ELSE power(0.5, ($7::bigint - last_access)::double precision / $8::double precision) END) AS score
       FROM memory.memory_entries WHERE type = ANY($9::text[])
       ORDER BY score ${direction}, last_access ${direction}
       LIMIT $10::integer`,
      [params.w5m, params.w1h, params.w24h, params.w7d, params.wTotal, params.wRecency, now, params.recencyHalfLifeMs, types, Number(options.limit)],
    ),
  )
  return rows.map((row) => ({ id: row.id, score: Number(row.score) }))
}

export async function listByFormula(db, options) {
  const scored = await listScored(db, options)
  return scored.map((row) => row.id)
}

export async function mergeEntryStats(db, intoId, fromId) {
  await db.queryParams(
    'memory',
    `UPDATE memory.memory_entries SET
       c_h5m = greatest(c_h5m, $2), c_1h = greatest(c_1h, $3), c_24h = greatest(c_24h, $4),
       c_7d = greatest(c_7d, $5), total_access = greatest(total_access, $6), last_access = greatest(last_access, $7)
     WHERE id = $1`,
    [intoId, Number(fromId.cH5m ?? fromId.c_h5m ?? 0), Number(fromId.c1h ?? fromId.c_1h ?? 0), Number(fromId.c24h ?? fromId.c_24h ?? 0), Number(fromId.c7d ?? fromId.c_7d ?? 0), Number(fromId.totalAccess ?? fromId.total_access ?? 0), Number(fromId.lastAccess ?? fromId.last_access ?? 0)],
  )
}

export function parseFormula(text) {
  const params = { w5m: 0, w1h: 0, w24h: 0, w7d: 0, wTotal: 0, wRecency: 0, recencyHalfLifeMs: DEFAULT_DECAY_PARAMS.recencyHalfLifeMs }
  const seen = new Set()
  for (const raw of String(text).trim().split(/\s+/).filter(Boolean)) {
    const match = /^([+-]?(?:\d+\.?\d*|\.\d+))\*([a-z0-9]+)(?:\/(\d+\.?\d*)([mhd]))?$/i.exec(raw)
    if (match === null) throw new MemoryValidationError('bad-formula', 'cannot parse term "' + raw + '" — expected like "4*d1h" or "4*recency/7d"')
    const weight = Number(match[1])
    const signal = match[2].toLowerCase()
    const unit = match[4] === undefined ? undefined : match[4].toLowerCase()
    if (seen.has(signal)) throw new MemoryValidationError('bad-formula', 'signal "' + signal + '" listed twice')
    seen.add(signal)
    if (unit !== undefined) {
      if (signal !== 'recency') throw new MemoryValidationError('bad-formula', 'only "recency" takes a half life such as "/7d", got "/' + match[3] + match[4] + '" on "' + signal + '"')
      params.recencyHalfLifeMs = Number(match[3]) * (unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000)
      continue
    }
    if (signal === 'd5m') params.w5m = weight
    else if (signal === 'd1h') params.w1h = weight
    else if (signal === 'd24h') params.w24h = weight
    else if (signal === 'd7d') params.w7d = weight
    else if (signal === 'total') params.wTotal = weight
    else if (signal === 'recency') params.wRecency = weight
    else throw new MemoryValidationError('bad-formula', 'unknown signal "' + signal + '" in "' + raw + '" (allowed: d5m/d1h/d24h/d7d/total/recency)')
  }
  return params
}

export function resolveDecayParams(patch) {
  const next = { ...DEFAULT_DECAY_PARAMS, ...(patch || {}) }
  for (const [key, value] of Object.entries(next)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new MemoryValidationError('bad-decay-param', key + ' must be a finite number (got ' + JSON.stringify(value) + ')')
    }
  }
  if (next.recencyHalfLifeMs <= 0) throw new MemoryValidationError('bad-decay-param', 'recencyHalfLifeMs must be > 0')
  return next
}
