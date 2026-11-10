import { MemoryRenderer } from './memory-render.js'
import { schemaPlan } from './memory-schema.js'

function stamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function vectorLiteral(vector) {
  return '[' + vector.map((value) => String(Number(value))).join(',') + ']'
}

function fitVector(vector, dimensions) {
  const values = Array.isArray(vector) ? vector.map((value) => Number(value)) : []
  if (values.length === dimensions) return values
  if (values.length > dimensions) return values.slice(0, dimensions)
  return values.concat(new Array(dimensions - values.length).fill(0))
}

export class MemoryMigration {
  constructor(db, config, embedding, schema) {
    this.db = db
    this.config = config
    this.embedding = embedding
    this.schema = schema
    this.renderer = new MemoryRenderer(db)
    this.running = false
    this.lastError = null
    this.activeId = null
  }

  async rows(sql, values = [], role = 'memory') {
    const result = await this.db.queryParams(role, sql, values)
    return (result.results && result.results[0] && result.results[0].rows) || []
  }

  async exec(sql, values = [], role = 'memory') {
    return this.db.queryParams(role, sql, values)
  }

  async active() {
    const rows = await this.rows(
      "SELECT * FROM memory.schema_migrations WHERE status IN ('pending', 'running', 'swapping', 'interrupted') ORDER BY id DESC LIMIT 1",
    )
    return rows.length ? rows[0] : null
  }

  async get(id) {
    const rows = await this.rows('SELECT * FROM memory.schema_migrations WHERE id = $1', [id])
    return rows.length ? rows[0] : null
  }

  async recoverInterrupted() {
    try {
      await this.exec(
        "UPDATE memory.schema_migrations SET status = 'interrupted', updated_at = now() WHERE status IN ('pending', 'running', 'swapping')",
      )
    } catch {}
  }

  async start() {
    if (this.running) throw Object.assign(new Error('memory migration is already running'), { status: 409 })
    let status = await this.schema.status()
    if (!status.installed) {
      await this.schema.ensure()
      status = await this.schema.status()
    }
    if (!status.installed) throw new Error('memory schema is not available')
    if (!status.needsMigration) throw new Error('memory schema dimensions already match the configured dimensions')
    const active = await this.active()
    if (active) throw Object.assign(new Error('memory migration already exists: ' + String(active.id) + ' (' + String(active.status) + ')'), { status: 409 })

    const next = schemaPlan(status.expected.dimensions)
    const fromVersion = Number(status.version)
    const toVersion = fromVersion + 1
    const nextTable = await this.rows("SELECT to_regclass('memory.memory_entries_vec_next') AS reg", [], 'admin')
    if (nextTable.length && nextTable[0].reg !== null) {
      throw new Error('leftover memory_entries_vec_next exists; inspect it before starting a new migration')
    }

    const totalRows = await this.rows('SELECT count(*)::int AS count FROM memory.memory_entries')
    const total = totalRows.length ? Number(totalRows[0].count) : 0
    const inserted = await this.exec(
      `INSERT INTO memory.schema_migrations
       (from_version, to_version, from_dimensions, to_dimensions, from_storage, to_storage, to_index, status, total_entries)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
       RETURNING id`,
      [fromVersion, toVersion, Number(status.dimensions), next.dimensions, String(status.storage), next.storage, next.index, total],
      'memory',
    )
    const row = (inserted.results && inserted.results[0] && inserted.results[0].rows && inserted.results[0].rows[0]) || null
    if (row === null) throw new Error('failed to create memory migration record')
    const id = row.id
    this.activeId = id
    this.running = true
    this.run(id).catch(() => {})
    return await this.get(id)
  }

  async resume(id) {
    if (this.running) throw Object.assign(new Error('memory migration is already running'), { status: 409 })
    const row = await this.get(id)
    if (row === null) throw Object.assign(new Error('memory migration not found'), { status: 404 })
    if (!['pending', 'failed', 'interrupted'].includes(row.status)) {
      throw new Error('memory migration cannot be resumed from status ' + String(row.status))
    }
    await this.exec("UPDATE memory.schema_migrations SET status = 'pending', error = NULL, updated_at = now() WHERE id = $1", [id])
    this.activeId = id
    this.running = true
    this.run(id).catch(() => {})
    return await this.get(id)
  }

  async run(id) {
    let nextTable = 'memory.memory_entries_vec_next'
    let backupTable = null
    try {
      const row = await this.get(id)
      if (row === null) throw new Error('memory migration not found')
      const next = schemaPlan(Number(row.to_dimensions))
      await this.exec("UPDATE memory.schema_migrations SET status = 'running', started_at = COALESCE(started_at, now()), updated_at = now(), error = NULL WHERE id = $1", [id])

      await this.exec(
        `CREATE TABLE IF NOT EXISTS memory.memory_entries_vec_next (
          memory_id text PRIMARY KEY REFERENCES memory.memory_entries(id) ON DELETE CASCADE,
          type text NOT NULL,
          embedding ${next.storageType} NOT NULL
        )`,
        [],
        'admin',
      )
      await this.exec(
        'CREATE INDEX IF NOT EXISTS idx_memory_entries_vec_next_type ON memory.memory_entries_vec_next (type)',
        [],
        'admin',
      )

      await this.exec('UPDATE memory.memory_entries SET vec_revision = 0, text_revision = GREATEST(text_revision, 1)')
      const expected = await this.rows('SELECT count(*)::int AS count FROM memory.memory_entries')
      const total = expected.length ? Number(expected[0].count) : 0
      await this.exec('UPDATE memory.schema_migrations SET total_entries = $2, updated_at = now() WHERE id = $1', [id, total])

      const probe = await this.embedding.probe()
      if (Number(probe.dimensions) !== next.dimensions) {
        throw new Error('embedding probe returned ' + String(probe.dimensions) + ' dimensions, expected ' + String(next.dimensions))
      }

      let lastId = ''
      while (true) {
        const batch = await this.rows(
          `SELECT id, type, text_revision FROM memory.memory_entries
           WHERE vec_revision < text_revision AND id > $1
           ORDER BY id LIMIT $2`,
          [lastId, 32],
        )
        if (batch.length === 0) break
        const texts = await this.renderer.expand(batch.map((entry) => entry.id))
        const inputs = batch.map((entry) => texts.get(entry.id) || '')
        const vectors = await this.embedding.embed(inputs)
        if (!Array.isArray(vectors) || vectors.length !== batch.length) throw new Error('embedding returned an unexpected vector count')
        for (let index = 0; index < batch.length; index += 1) {
          const entry = batch[index]
          const vector = fitVector(vectors[index], next.dimensions)
          await this.exec(
            `INSERT INTO memory.memory_entries_vec_next (memory_id, type, embedding)
             VALUES ($1, $2, $3::${next.storageType})
             ON CONFLICT (memory_id) DO UPDATE SET type = EXCLUDED.type, embedding = EXCLUDED.embedding`,
            [entry.id, entry.type, vectorLiteral(vector)],
          )
          await this.exec('UPDATE memory.memory_entries SET vec_revision = $2 WHERE id = $1 AND text_revision = $2', [entry.id, Number(entry.text_revision)])
        }
        lastId = batch[batch.length - 1].id
        await this.exec(
          'UPDATE memory.schema_migrations SET processed_entries = processed_entries + $2, last_memory_id = $3, updated_at = now() WHERE id = $1',
          [id, batch.length, lastId],
        )
      }

      const pending = await this.rows('SELECT count(*)::int AS count FROM memory.memory_entries WHERE vec_revision < text_revision')
      if (pending.length && Number(pending[0].count) > 0) throw new Error('memory entries are still pending after re-embedding')
      const nextCount = await this.rows('SELECT count(*)::int AS count FROM memory.memory_entries_vec_next')
      const vectorCount = nextCount.length ? Number(nextCount[0].count) : 0
      if (vectorCount !== total) throw new Error('re-embedded vector count ' + String(vectorCount) + ' does not match entry count ' + String(total))

      await this.exec(
        `CREATE INDEX IF NOT EXISTS idx_memory_entries_vec_next_hnsw
         ON memory.memory_entries_vec_next USING hnsw (${next.indexExpression})`,
        [],
        'admin',
      )
      await this.exec('ANALYZE memory.memory_entries_vec_next', [], 'admin')

      backupTable = 'memory_entries_vec_old_' + stamp()
      const oldPkey = backupTable + '_pkey'
      const oldType = backupTable + '_type'
      const oldHnsw = backupTable + '_hnsw'
      const swap = `
BEGIN;
LOCK TABLE memory.memory_entries_vec IN ACCESS EXCLUSIVE MODE;
ALTER INDEX memory.idx_memory_entries_vec_hnsw RENAME TO ${oldHnsw};
ALTER INDEX memory.idx_memory_entries_vec_type RENAME TO ${oldType};
ALTER INDEX memory.memory_entries_vec_pkey RENAME TO ${oldPkey};
ALTER TABLE memory.memory_entries_vec RENAME TO ${backupTable};
ALTER TABLE memory.memory_entries_vec_next RENAME TO memory_entries_vec;
ALTER INDEX memory.idx_memory_entries_vec_next_hnsw RENAME TO idx_memory_entries_vec_hnsw;
ALTER INDEX memory.idx_memory_entries_vec_next_type RENAME TO idx_memory_entries_vec_type;
ALTER INDEX memory.memory_entries_vec_next_pkey RENAME TO memory_entries_vec_pkey;
INSERT INTO memory.schema_version (version, embedding_dimensions, embedding_storage, embedding_index)
VALUES (${Number(row.to_version)}, ${next.dimensions}, '${next.storage}', '${next.index}');
UPDATE memory.schema_migrations
SET status = 'completed', processed_entries = processed_entries, backup_table = '${backupTable}', updated_at = now(), finished_at = now()
WHERE id = ${Number(id)};
COMMIT;
`
      await this.exec(swap, [], 'admin')
      this.running = false
      this.activeId = null
      this.lastError = null
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      try {
        await this.exec(
          "UPDATE memory.schema_migrations SET status = 'failed', error = $2, updated_at = now() WHERE id = $1",
          [id, this.lastError],
        )
      } catch {}
      this.running = false
      this.activeId = null
      throw error
    }
  }
}
