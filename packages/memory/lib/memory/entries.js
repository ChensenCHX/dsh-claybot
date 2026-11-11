import { isValidScope } from './types.js'
import { MemoryValidationError, checkNewEntry, checkSlotUpdate } from './validate.js'
import { deleteEntryVector, upsertEntryVector } from './vec.js'
import { entryId } from './ids.js'

const ENTRY_COLS =
  'id, template, type, scope, source, depth, created_at, origin_msg_ids, last_access, c_h5m, c_1h, c_24h, c_7d, total_access, counters_settled_at, text_revision, vec_revision'

function rowsOf(result) {
  return (result.results && result.results[0] && result.results[0].rows) || []
}

function toEntry(row) {
  return {
    id: row.id,
    template: row.template,
    type: row.type,
    scope: row.scope,
    source: row.source,
    depth: Number(row.depth),
    createdAt: Number(row.created_at),
    originMsgIds: row.origin_msg_ids ? JSON.parse(row.origin_msg_ids) : null,
    lastAccess: Number(row.last_access),
    cH5m: Number(row.c_h5m),
    c1h: Number(row.c_1h),
    c24h: Number(row.c_24h),
    c7d: Number(row.c_7d),
    totalAccess: Number(row.total_access),
    countersSettledAt: Number(row.counters_settled_at),
    textRevision: Number(row.text_revision),
    vecRevision: Number(row.vec_revision),
  }
}

function toRefRow(row) {
  return { ord: Number(row.ord), kind: row.ref_kind, id: row.ref_id }
}

export async function createEntry(db, input) {
  const check = await checkNewEntry(db, input)
  if (!check.ok) throw new MemoryValidationError(check.error.code, check.error.message)
  const now = Date.now()
  const inserted = await db.queryParams(
    'memory',
    `INSERT INTO memory.memory_entries (id, template, type, scope, source, depth, created_at, origin_msg_ids, last_access)
     VALUES ('tmp-' || nextval(pg_get_serial_sequence('memory.memory_entries', 'seq')), $1, $2, $3, $4, $5, $6, $7, $8) RETURNING seq`,
    [input.template, input.type, check.scope, input.source === undefined ? null : input.source, check.depth, now, check.originMsgIds === null ? null : JSON.stringify(check.originMsgIds), now],
  )
  const seq = Number(rowsOf(inserted)[0].seq)
  const id = entryId(seq)
  await db.queryParams('memory', 'UPDATE memory.memory_entries SET id = $2 WHERE seq = $1', [seq, id])
  for (let ord = 0; ord < input.refs.length; ord += 1) {
    const slot = input.refs[ord]
    await db.queryParams('memory', 'INSERT INTO memory.memory_entry_refs (memory_id, ord, ref_kind, ref_id) VALUES ($1, $2, $3, $4)', [id, ord, slot.kind, slot.id === undefined ? null : slot.id])
  }
  return id
}

export async function restoreEntry(db, entry, refs) {
  const check = await checkNewEntry(db, { template: entry.template, type: entry.type, scope: entry.scope, refs, originMsgIds: entry.originMsgIds === null ? undefined : entry.originMsgIds })
  if (!check.ok) throw new MemoryValidationError(check.error.code, check.error.message)
  const inserted = await db.queryParams(
    'memory',
    `INSERT INTO memory.memory_entries (id, template, type, scope, source, depth, created_at, origin_msg_ids, last_access,
       c_h5m, c_1h, c_24h, c_7d, total_access, counters_settled_at, text_revision, vec_revision)
     VALUES ('tmp-' || nextval(pg_get_serial_sequence('memory.memory_entries', 'seq')), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING seq`,
    [
      entry.template, entry.type, entry.scope, entry.source, check.depth, entry.createdAt,
      entry.originMsgIds === null ? null : JSON.stringify(entry.originMsgIds), entry.lastAccess,
      entry.cH5m, entry.c1h, entry.c24h, entry.c7d, entry.totalAccess, entry.countersSettledAt, entry.textRevision, entry.vecRevision,
    ],
  )
  const seq = Number(rowsOf(inserted)[0].seq)
  const id = entry.id === undefined || entry.id === null ? entryId(seq) : String(entry.id)
  await db.queryParams('memory', 'UPDATE memory.memory_entries SET id = $2 WHERE seq = $1', [seq, id])
  for (let ord = 0; ord < refs.length; ord += 1) {
    const slot = refs[ord]
    await db.queryParams('memory', 'INSERT INTO memory.memory_entry_refs (memory_id, ord, ref_kind, ref_id) VALUES ($1, $2, $3, $4)', [id, ord, slot.kind, slot.id === undefined ? null : slot.id])
  }
  return id
}

export async function getEntry(db, id) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT ' + ENTRY_COLS + ' FROM memory.memory_entries WHERE id = $1', [id]))
  return rows.length > 0 ? toEntry(rows[0]) : null
}

export async function getEntriesByIds(db, ids) {
  const list = [...new Set((ids || []).map((id) => String(id)))]
  if (list.length === 0) return []
  const rows = rowsOf(await db.queryParams('memory', 'SELECT ' + ENTRY_COLS + ' FROM memory.memory_entries WHERE id = ANY($1::text[])', [list]))
  return rows.map(toEntry)
}

export async function listRefs(db, memoryId) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT ord, ref_kind, ref_id FROM memory.memory_entry_refs WHERE memory_id = $1 ORDER BY ord', [memoryId]))
  return rows.map(toRefRow)
}

export async function listRefsFor(db, ids) {
  const out = new Map()
  const list = [...new Set((ids || []).map((id) => String(id)))]
  if (list.length === 0) return out
  const rows = rowsOf(
    await db.queryParams('memory', 'SELECT memory_id, ord, ref_kind, ref_id FROM memory.memory_entry_refs WHERE memory_id = ANY($1::text[]) ORDER BY memory_id, ord', [list]),
  )
  for (const row of rows) {
    if (!out.has(row.memory_id)) out.set(row.memory_id, [])
    out.get(row.memory_id).push(toRefRow(row))
  }
  return out
}

export async function listReferrers(db, refId, kind) {
  const rows = kind === undefined
    ? rowsOf(await db.queryParams('memory', 'SELECT DISTINCT memory_id FROM memory.memory_entry_refs WHERE ref_id = $1', [refId]))
    : rowsOf(await db.queryParams('memory', 'SELECT DISTINCT memory_id FROM memory.memory_entry_refs WHERE ref_id = $1 AND ref_kind = $2', [refId, kind]))
  return rows.map((row) => row.memory_id)
}

export async function countReferrers(db, refId, kind) {
  const rows = kind === undefined
    ? rowsOf(await db.queryParams('memory', 'SELECT COUNT(DISTINCT memory_id) AS n FROM memory.memory_entry_refs WHERE ref_id = $1', [refId]))
    : rowsOf(await db.queryParams('memory', 'SELECT COUNT(DISTINCT memory_id) AS n FROM memory.memory_entry_refs WHERE ref_id = $1 AND ref_kind = $2', [refId, kind]))
  return rows.length > 0 ? Number(rows[0].n) : 0
}

export async function listReferencingEntries(db, refId, options) {
  const ids = await listReferrers(db, refId, options.kind)
  const entries = await getEntriesByIds(db, ids)
  entries.sort((a, b) => b.lastAccess - a.lastAccess)
  return { total: entries.length, entries: entries.slice(0, options.limit) }
}

export async function countReferrersAll(db, ids, kind) {
  const list = [...new Set((ids || []).map((id) => String(id)))]
  if (list.length === 0) return 0
  const rows = kind === undefined
    ? rowsOf(
        await db.queryParams(
          'memory',
          'SELECT count(*) AS n FROM (SELECT DISTINCT ref_id, memory_id FROM memory.memory_entry_refs WHERE ref_id = ANY($1::text[])) AS d',
          [list],
        ),
      )
    : rowsOf(
        await db.queryParams(
          'memory',
          'SELECT count(*) AS n FROM (SELECT DISTINCT ref_id, memory_id FROM memory.memory_entry_refs WHERE ref_id = ANY($1::text[]) AND ref_kind = $2) AS d',
          [list, kind],
        ),
      )
  return rows.length > 0 ? Number(rows[0].n) : 0
}

export async function deleteEntry(db, id) {
  await markReferrers(db, id, 'm')
  await db.queryParams('memory', 'DELETE FROM memory.memory_entries WHERE id = $1', [id])
  await deleteEntryVector(db, id)
  await db.queryParams('memory', 'DELETE FROM memory.memory_entry_refs WHERE memory_id = $1', [id])
}

export async function repointRefs(db, fromId, toId) {
  const targetRows = rowsOf(await db.queryParams('memory', 'SELECT depth FROM memory.memory_entries WHERE id = $1', [toId]))
  const targetDepth = targetRows.length > 0 ? Number(targetRows[0].depth) : null
  const referrers = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT DISTINCT r.memory_id AS memory_id, e.depth AS depth
         FROM memory.memory_entry_refs r JOIN memory.memory_entries e ON e.id = r.memory_id
        WHERE r.ref_id = $1`,
      [fromId],
    ),
  )
  const ok = []
  let dangling = 0
  for (const row of referrers) {
    if (targetDepth !== null && targetDepth >= Number(row.depth)) {
      dangling += 1
      continue
    }
    ok.push(row.memory_id)
  }
  await markReferrers(db, fromId)
  for (const memoryId of ok) {
    await db.queryParams('memory', 'UPDATE memory.memory_entry_refs SET ref_id = $1 WHERE ref_id = $2 AND memory_id = $3', [toId, fromId, memoryId])
  }
  return { rewritten: ok.length, dangling }
}

export async function setRefSlot(db, memoryId, ord, slot) {
  const self = await getEntry(db, memoryId)
  if (self === null) throw new MemoryValidationError('ref-missing', 'entry ' + memoryId + ' does not exist')
  const current = await listRefs(db, memoryId)
  if (ord < 0 || ord >= current.length) {
    throw new MemoryValidationError('ref-count-mismatch', 'slot ' + String(ord) + ' does not exist: this entry has ' + String(current.length) + ' slots (the length is fixed — replace in place or set null)')
  }
  const error = await checkSlotUpdate(db, self, ord, slot)
  if (error !== null) throw new MemoryValidationError(error.code, error.message)
  await db.queryParams('memory', 'UPDATE memory.memory_entry_refs SET ref_kind = $3, ref_id = $4 WHERE memory_id = $1 AND ord = $2', [memoryId, ord, slot.kind, slot.id === undefined ? null : slot.id])
  await markTextChanged(db, [memoryId])
}

export async function setScope(db, id, scope) {
  if (!isValidScope(scope)) throw new MemoryValidationError('scope-invalid', 'scope "' + scope + '" is invalid: only global or a conversation id (group:<gid> / private:<uid>)')
  await db.queryParams('memory', 'UPDATE memory.memory_entries SET scope = $2 WHERE id = $1', [id, scope])
}

export async function bumpRecency(db, id, at = Date.now()) {
  await db.queryParams('memory', 'UPDATE memory.memory_entries SET last_access = $2 WHERE id = $1', [id, at])
}

export async function markTextChanged(db, ids) {
  const list = [...new Set((ids || []).map((id) => String(id)))]
  if (list.length === 0) return
  await db.queryParams('memory', 'UPDATE memory.memory_entries SET text_revision = text_revision + 1 WHERE id = ANY($1::text[])', [list])
}

export async function writeEmbedding(db, id, type, embedding, revision, dimensions) {
  await upsertEntryVector(db, id, type, embedding, dimensions)
  await db.queryParams('memory', 'UPDATE memory.memory_entries SET vec_revision = $2 WHERE id = $1', [id, revision])
}

export async function listPendingEmbed(db, limit) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT id, template FROM memory.memory_entries WHERE vec_revision < text_revision ORDER BY id LIMIT $1', [limit]))
  return rows.map((row) => ({ id: row.id, template: row.template }))
}

export async function listShortCursor(db, watermark, limit) {
  const rows = rowsOf(
    await db.queryParams('memory', `SELECT ${ENTRY_COLS} FROM memory.memory_entries WHERE type = 'short' AND last_access >= $1 ORDER BY last_access ASC LIMIT $2`, [watermark, limit]),
  )
  return rows.map(toEntry)
}

export async function countByType(db, type) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT count(*) AS n FROM memory.memory_entries WHERE type = $1', [type]))
  return rows.length > 0 ? Number(rows[0].n) : 0
}

async function markReferrers(db, refId, kind) {
  if (kind === undefined) {
    await db.queryParams(
      'memory',
      'UPDATE memory.memory_entries SET text_revision = text_revision + 1 WHERE id IN (SELECT DISTINCT memory_id FROM memory.memory_entry_refs WHERE ref_id = $1)',
      [refId],
    )
    return
  }
  await db.queryParams(
    'memory',
    'UPDATE memory.memory_entries SET text_revision = text_revision + 1 WHERE id IN (SELECT DISTINCT memory_id FROM memory.memory_entry_refs WHERE ref_id = $1 AND ref_kind = $2)',
    [refId, kind],
  )
}
