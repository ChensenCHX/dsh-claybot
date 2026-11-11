import { getEntitiesByIds, searchEntities } from './entities.js'
import { getEntriesByIds, listRefsFor } from './entries.js'
import { listByFormula, touchEntries } from './stats.js'
import { vecLiteral, storageColumn } from './vec.js'
import { ALL_TYPES, RECALL_MAXK_DEFAULT, RECALL_MAXK_LIMIT } from './types.js'

const CAND_MIN = 300
const CAND_LIMIT = 1000

function rowsOf(result) {
  return (result.results && result.results[0] && result.results[0].rows) || []
}

async function resolveEntityTokens(db, tokens) {
  const resolved = []
  const unresolved = []
  for (const raw of tokens || []) {
    const token = String(raw).trim()
    if (token === '') continue
    if (token.startsWith('ent_')) {
      const found = await getEntitiesByIds(db, [token])
      if (found.length > 0) resolved.push(token)
      else unresolved.push(token)
      continue
    }
    const candidates = await searchEntities(db, { query: token, limit: 5 })
    const picked = candidates.find((entity) => entity.name === token) || candidates[0]
    if (picked !== undefined) resolved.push(picked.id)
    else unresolved.push(token)
  }
  return { resolved: [...new Set(resolved)], unresolved }
}

async function knnScored(db, queryVec, types, limit, dimensions) {
  const dim = Number(dimensions)
  const literal = vecLiteral(queryVec)
  const params = [literal, types, limit]
  if (dim <= 4000) {
    const column = storageColumn(dim)
    const rows = rowsOf(
      await db.queryParams(
        'memory',
        `SELECT memory_id, 1 - (embedding <=> $1::${column}) AS score
         FROM memory.memory_entries_vec WHERE type = ANY($2::text[])
         ORDER BY embedding <=> $1::${column} LIMIT $3`,
        params,
      ),
    )
    return rows.map((row) => ({ id: row.memory_id, score: Number(row.score) }))
  }
  // n > 4000：索引建在前 4000 维上，候选必须用同一个截断表达式；再按完整向量 rerank。
  const prefix = subvectorIndex(dim)
  const candidates = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT memory_id FROM memory.memory_entries_vec WHERE type = ANY($2::text[])
       ORDER BY ${prefix} <=> $1::halfvec(4000) LIMIT $3`,
      [prefixLiteral(queryVec, dim), types, Math.min(limit * 4, CAND_LIMIT)],
    ),
  )
  if (candidates.length === 0) return []
  const ids = candidates.map((row) => row.memory_id)
  const reranked = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT memory_id, 1 - (embedding <=> $1::${storageColumn(dim)}) AS score
       FROM memory.memory_entries_vec WHERE memory_id = ANY($2::text[])
       ORDER BY embedding <=> $1::${storageColumn(dim)} LIMIT $3`,
      [literal, ids, limit],
    ),
  )
  return reranked.map((row) => ({ id: row.memory_id, score: Number(row.score) }))
}

function subvectorIndex() {
  return '(subvector(embedding, 1, 4000))::halfvec(4000)'
}

function prefixLiteral(vector, dimensions) {
  const dim = Number(dimensions)
  const prefix = Array.from(vector).slice(0, Math.min(4000, dim)).map((value) => String(Number(value)))
  return '[' + prefix.join(',') + ']'
}

async function filterByEntities(db, candidateIds, entityIds) {
  if (entityIds.length === 0 || candidateIds.length === 0) return candidateIds
  const want = new Set(entityIds)
  const hit = new Map()
  const add = (memoryId, entityId) => {
    if (!hit.has(memoryId)) hit.set(memoryId, new Set())
    hit.get(memoryId).add(entityId)
  }
  const refs = await listRefsFor(db, candidateIds)
  const hopTargets = new Set()
  for (const [memoryId, list] of refs) {
    for (const ref of list) {
      if (ref.id === null) continue
      if (ref.kind === 'e') {
        if (want.has(ref.id)) add(memoryId, ref.id)
      } else {
        hopTargets.add(ref.id)
      }
    }
  }
  if (hopTargets.size > 0) {
    const hopRefs = await listRefsFor(db, [...hopTargets])
    const hopHit = new Map()
    for (const [hopId, list] of hopRefs) {
      for (const ref of list) {
        if (ref.kind !== 'e' || ref.id === null || !want.has(ref.id)) continue
        if (!hopHit.has(hopId)) hopHit.set(hopId, new Set())
        hopHit.get(hopId).add(ref.id)
      }
    }
    if (hopHit.size > 0) {
      for (const [memoryId, list] of refs) {
        for (const ref of list) {
          if (ref.kind !== 'm' || ref.id === null) continue
          for (const entityId of hopHit.get(ref.id) || []) add(memoryId, entityId)
        }
      }
    }
  }
  return candidateIds.filter((id) => (hit.get(id) === undefined ? 0 : hit.get(id).size) === want.size)
}

export async function recallEntries(deps, options) {
  const db = deps.db
  const now = options.now === undefined ? Date.now() : Number(options.now)
  const rawK = Number.isFinite(Number(options.maxK)) ? Math.trunc(Number(options.maxK)) : RECALL_MAXK_DEFAULT
  const maxK = Math.min(Math.max(rawK, 1), RECALL_MAXK_LIMIT)
  const types = options.types !== undefined && options.types.length > 0 ? [...new Set(options.types)] : [...ALL_TYPES]
  const resolvedResult = await resolveEntityTokens(db, options.entities === undefined ? [] : options.entities)
  const resolved = resolvedResult.resolved
  const unresolved = resolvedResult.unresolved
  const cand = resolved.length > 0 ? Math.min(Math.max(CAND_MIN, maxK * 20), CAND_LIMIT) : maxK

  let pool = []
  let scored = new Map()
  let degraded
  try {
    const queryVec = await deps.embedText(options.query)
    const hits = await knnScored(db, queryVec, types, cand, deps.dimensions())
    pool = hits.map((hit) => hit.id)
    scored = new Map(hits.map((hit) => [hit.id, hit.score]))
  } catch (error) {
    degraded = 'embedding-unavailable'
    deps.lastError = error instanceof Error ? error.message : String(error)
    pool = await listByFormula(db, { direction: 'hot', limit: cand, types, now })
  }

  const filtered = resolved.length > 0 ? await filterByEntities(db, pool, resolved) : pool
  const finalIds = filtered.slice(0, maxK)
  const entries = await getEntriesByIds(db, finalIds)
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const texts = await deps.expand(finalIds)
  await touchEntries(db, finalIds, now)

  const hits = []
  for (const id of finalIds) {
    const entry = byId.get(id)
    if (entry === undefined) continue
    hits.push({
      id,
      type: entry.type,
      scope: entry.scope,
      createdAt: entry.createdAt,
      score: scored.has(id) ? scored.get(id) : null,
      text: texts.get(id) === undefined ? entry.template : texts.get(id),
    })
  }

  const result = { hits, maxK, types }
  if (resolved.length > 0 || unresolved.length > 0) result.filter = { resolved, unresolved, passed: filtered.length }
  if (degraded !== undefined) result.degraded = degraded
  return result
}
