import { MemoryValidationError, checkEntityName } from './validate.js'
import { entityId as buildEntityId } from './ids.js'

const ENTITY_COLS = 'id, name, created_at'

function rowsOf(result) {
  return (result.results && result.results[0] && result.results[0].rows) || []
}

function toEntity(row) {
  return { id: row.id, name: row.name, createdAt: Number(row.created_at) }
}

export async function createEntity(db, name, id) {
  const error = checkEntityName(name)
  if (error !== null) throw new MemoryValidationError(error.code, error.message)
  const now = Date.now()
  const inserted = await db.queryParams(
    'memory',
    `INSERT INTO memory.memory_entities (id, name, created_at)
     VALUES ('tmp-' || nextval(pg_get_serial_sequence('memory.memory_entities', 'seq')), $1, $2) RETURNING seq`,
    [String(name), now],
  )
  const seq = Number(rowsOf(inserted)[0].seq)
  const entityIdValue = id === undefined ? buildEntityId(seq) : String(id)
  await db.queryParams('memory', 'UPDATE memory.memory_entities SET id = $2 WHERE seq = $1', [seq, entityIdValue])
  return entityIdValue
}

export async function getEntity(db, id) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT ' + ENTITY_COLS + ' FROM memory.memory_entities WHERE id = $1', [id]))
  return rows.length > 0 ? toEntity(rows[0]) : null
}

export async function getEntitiesByIds(db, ids) {
  const list = [...new Set((ids || []).map((id) => String(id)))]
  if (list.length === 0) return []
  const rows = rowsOf(await db.queryParams('memory', 'SELECT ' + ENTITY_COLS + ' FROM memory.memory_entities WHERE id = ANY($1::text[])', [list]))
  return rows.map(toEntity)
}

export async function searchEntities(db, options) {
  const limit = options.limit === undefined ? 20 : Number(options.limit)
  const rows = rowsOf(
    await db.queryParams('memory', 'SELECT ' + ENTITY_COLS + ' FROM memory.memory_entities WHERE name ILIKE $1 ORDER BY created_at DESC LIMIT $2', ['%' + String(options.query) + '%', limit]),
  )
  return rows.map(toEntity)
}

export async function listOrphanEntities(db, olderThanMs, limit = 50) {
  const rows = rowsOf(
    await db.queryParams(
      'memory',
      `SELECT ${ENTITY_COLS} FROM memory.memory_entities e
        WHERE e.created_at <= $1
          AND NOT EXISTS (SELECT 1 FROM memory.memory_entry_refs r WHERE r.ref_id = e.id)
        ORDER BY e.created_at ASC LIMIT $2`,
      [Date.now() - Number(olderThanMs), limit],
    ),
  )
  return rows.map(toEntity)
}

export async function deleteEntity(db, id) {
  await db.queryParams(
    'memory',
    "UPDATE memory.memory_entries SET text_revision = text_revision + 1 WHERE id IN (SELECT DISTINCT memory_id FROM memory.memory_entry_refs WHERE ref_kind = 'e' AND ref_id = $1)",
    [id],
  )
  await db.queryParams('memory', 'DELETE FROM memory.memory_entities WHERE id = $1', [id])
}
