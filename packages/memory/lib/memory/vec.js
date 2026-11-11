export function vecLiteral(vector) {
  return '[' + Array.from(vector, (value) => String(Number(value))).join(',') + ']'
}

function rowsOf(result) {
  return (result.results && result.results[0] && result.results[0].rows) || []
}

export function storageColumn(dimensions) {
  const dim = Number(dimensions)
  return (dim < 2000 ? 'vector' : 'halfvec') + '(' + String(dim) + ')'
}

export async function upsertEntryVector(db, memoryId, type, embedding, dimensions) {
  const column = storageColumn(dimensions)
  await db.queryParams(
    'memory',
    `INSERT INTO memory.memory_entries_vec (memory_id, type, embedding) VALUES ($1, $2, $3::${column})
     ON CONFLICT (memory_id) DO UPDATE SET type = EXCLUDED.type, embedding = EXCLUDED.embedding`,
    [memoryId, type, vecLiteral(embedding)],
  )
}

export async function deleteEntryVector(db, memoryId) {
  await db.queryParams('memory', 'DELETE FROM memory.memory_entries_vec WHERE memory_id = $1', [memoryId])
}

export async function hasEntryVector(db, memoryId) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT memory_id FROM memory.memory_entries_vec WHERE memory_id = $1', [memoryId]))
  return rows.length > 0
}

export async function getEntryVector(db, memoryId) {
  const rows = rowsOf(await db.queryParams('memory', 'SELECT embedding::text AS embedding FROM memory.memory_entries_vec WHERE memory_id = $1', [memoryId]))
  if (rows.length === 0) return null
  const text = String(rows[0].embedding || '')
  const trimmed = text.trim().replace(/^\[/, '').replace(/\]$/, '')
  if (trimmed === '') return []
  return trimmed.split(',').map((part) => Number(part))
}
