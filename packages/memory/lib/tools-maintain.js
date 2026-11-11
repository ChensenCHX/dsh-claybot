import { formatAge, formatTimestamp } from './memory/types.js'
import { clampInteger, textBlock } from './memory/format.js'
import { createEntity, deleteEntity, getEntity, listOrphanEntities, searchEntities } from './memory/entities.js'
import { bumpRecency as bumpRecencyEntry, getEntry } from './memory/entries.js'
import { listScored, parseFormula, resolveDecayParams } from './memory/stats.js'
import { MemoryValidationError } from './memory/validate.js'

const DAY_MS = 86400000
const CANDIDATE_DEFAULT_LIMIT = 20
const CANDIDATE_LIMIT_MAX = 50
const ORPHAN_DEFAULT_DAYS = 7

function rowsToError(error) {
  if (error instanceof MemoryValidationError) {
    return Object.assign(new Error(error.message), { code: error.code, hint: error.hint })
  }
  return error
}

export function createMaintainTools(deps) {
  const db = deps.db

  const candidates = {
    name: 'memory-candidates',
    description: '列出待维护记忆候选：cold 为遗忘候选，hot 为升级候选。',
    parameters: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['cold', 'hot'], description: 'cold = 遗忘候选；hot = 升级候选' },
        limit: { type: 'number', description: '返回条数上限，最大 ' + String(CANDIDATE_LIMIT_MAX) + ' 条，默认 ' + String(CANDIDATE_DEFAULT_LIMIT) + ' 条' },
        formula: {
          type: 'string',
          description: '排序权重，如 `8*d5m 4*d1h 2*d24h 1*d7d 0.05*total 4*recency`（未写出的项 = 0；`recency` 可带半衰期如 `4*recency/7d`，省略 = 24h）',
        },
      },
      required: ['mode'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          mode: { type: 'string', enum: ['cold', 'hot'] },
          count: { type: 'integer' },
          hits: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['short', 'long', 'persona'] },
                scope: { type: 'string' },
                score: { type: 'number' },
                lastAccess: { type: 'string', description: '多久以前，如 3.14m' },
                text: { type: 'string' },
                missing: { type: 'boolean', description: '条目已被删除时为 true' },
              },
            },
          },
        },
      },
      render(_args, value) {
        if (value.hits.length === 0) return textBlock('[memory-candidates] mode=' + value.mode + ' 0 entries')
        const lines = ['[memory-candidates] mode=' + value.mode + ' count=' + String(value.count), 'columns: rank | score | type | scope | id | last_access | text']
        value.hits.forEach((hit, index) => {
          const rank = String(index + 1)
          const score = Number(hit.score).toFixed(1)
          if (hit.missing === true) {
            lines.push(rank + ' | ' + score + ' | ? | ? | ' + hit.id + ' | (missing)')
            return
          }
          lines.push(rank + ' | ' + score + ' | ' + hit.type + ' | ' + hit.scope + ' | ' + hit.id + ' | ' + hit.lastAccess + ' | ' + hit.text)
        })
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      if (args.mode !== 'cold' && args.mode !== 'hot') {
        throw Object.assign(new Error('bad-mode (' + String(args.mode) + '; allowed: cold/hot)'), { code: 'MEMORY_INVALID_ARGUMENT' })
      }
      const limit = clampInteger(args.limit, CANDIDATE_DEFAULT_LIMIT, 1, CANDIDATE_LIMIT_MAX)
      let params
      try {
        params = resolveDecayParams(args.formula === undefined ? undefined : parseFormula(args.formula))
      } catch (error) {
        throw rowsToError(error)
      }
      const now = Date.now()
      const scored = await listScored(db, { direction: args.mode, limit, params, now })
      const hits = []
      for (const row of scored) {
        const entry = await getEntry(db, row.id)
        if (entry === null) {
          hits.push({ id: row.id, score: row.score, missing: true })
          continue
        }
        const texts = await deps.expand([row.id])
        hits.push({
          id: row.id,
          type: entry.type,
          scope: entry.scope,
          score: row.score,
          lastAccess: formatAge(entry.lastAccess, now),
          text: texts.get(row.id) === undefined ? entry.template : texts.get(row.id),
        })
      }
      return { mode: args.mode, count: hits.length, hits }
    },
  }

  const entityOrphans = {
    name: 'memory-entity-orphans',
    description: '列出长期无人引用的实体。',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: '零引用超过多少天算孤儿（可为小数，默认 ' + String(ORPHAN_DEFAULT_DAYS) + ' 天）' },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          days: { type: 'number' },
          count: { type: 'integer' },
          orphans: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                createdAt: { type: 'string', description: 'ISO 8601 本地时间带偏移' },
                age: { type: 'string', description: '多久以前，如 12.30d' },
              },
            },
          },
        },
      },
      render(_args, value) {
        if (value.orphans.length === 0) {
          return textBlock('[memory-entity-orphans] 0 entities (older than ' + String(value.days) + 'd, zero refs)')
        }
        const lines = ['[memory-entity-orphans] count=' + String(value.count) + ' days=' + String(value.days)]
        value.orphans.forEach((entity, index) => {
          lines.push(String(index + 1) + ' | ' + entity.id + ' | ' + entity.name + ' | ' + entity.age + ' old | ' + entity.createdAt)
        })
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      const days = args.days === undefined || !Number.isFinite(Number(args.days)) ? ORPHAN_DEFAULT_DAYS : Math.max(0, Number(args.days))
      const now = Date.now()
      const orphans = await listOrphanEntities(db, days * DAY_MS, CANDIDATE_LIMIT_MAX)
      return {
        days,
        count: orphans.length,
        orphans: orphans.map((entity) => ({
          id: entity.id,
          name: entity.name,
          createdAt: formatTimestamp(entity.createdAt),
          age: formatAge(entity.createdAt, now),
        })),
      }
    },
  }

  const createEntityTool = {
    name: 'memory-create-entity',
    description: '新建一个记忆实体。',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '实体名（任意字符串，最多 64 字符；习惯用前缀标注字面量类别，如 QQID:/GRP:/NICK:/PLACE:/EVENT:；允许但不建议重名）',
        },
      },
      required: ['name'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          sameName: { type: 'array', items: { type: 'string' }, description: '已有同名实体 id（最多 3 个）' },
        },
      },
      render(_args, value) {
        const lines = ['[memory-create-entity] id=' + value.id + ' name=' + value.name]
        if (value.sameName.length > 0) lines.push('# hint: same-name entity exists (' + value.sameName.join(', ') + ')')
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      let id
      try {
        id = await createEntity(db, args.name)
      } catch (error) {
        throw rowsToError(error)
      }
      const same = await searchEntities(db, { query: args.name, limit: 3 })
      return { id, name: args.name, sameName: same.filter((entity) => entity.name === args.name && entity.id !== id).map((entity) => entity.id) }
    },
  }

  const deleteEntityTool = {
    name: 'memory-delete-entity',
    description: '删除一个记忆实体（不可逆）。引用它的条目会被标脏重嵌。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '实体 id（ent_*，如 ent_b54c6f6a）' },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          referrers: { type: 'integer', description: '删除前直接引用它的条目数' },
        },
      },
      render(_args, value) {
        return textBlock('[memory-delete-entity] id=' + value.id + ' name=' + value.name + ' referrers=' + String(value.referrers))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const id = String(args.id)
      const entity = await getEntity(db, id)
      if (entity === null) throw Object.assign(new Error('entity-not-found (' + id + ')'), { code: 'MEMORY_NOT_FOUND' })
      const referrers = await deps.countReferrers(id, 'e')
      try {
        await deleteEntity(db, id)
      } catch (error) {
        throw rowsToError(error)
      }
      return { id: entity.id, name: entity.name, referrers }
    },
  }

  return [candidates, entityOrphans, createEntityTool, deleteEntityTool]
}

function batchError(message, code = 'MEMORY_INVALID_ARGUMENT') {
  return Object.assign(new Error(message), { code })
}

export function createMaintainBatch2Tools(deps) {
  const db = deps.db

  const mergeEntities = {
    name: 'memory-merge-entities',
    description: '合并两个记忆实体：把指向 from 的引用整体改指到 to，然后删除 from（不可逆）。',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '被合并的实体 id（ent_*），合并后会被删除' },
        to: { type: 'string', description: '合并到的实体 id（ent_*）' },
      },
      required: ['from', 'to'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          fromName: { type: 'string' },
          toName: { type: 'string' },
          rewritten: { type: 'integer', description: '改指成功的引用者条目数' },
        },
      },
      render(_args, value) {
        return textBlock(
          '[memory-merge-entities] from=' + value.from + '(' + value.fromName + ') to=' + value.to + '(' + value.toName + ') rewritten=' + String(value.rewritten),
        )
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const fromId = String(args.from)
      const toId = String(args.to)
      if (fromId === toId) throw batchError('bad-merge (from and to are the same id)')
      const from = await getEntity(db, fromId)
      if (from === null) throw batchError('entity-not-found (' + fromId + ')', 'MEMORY_NOT_FOUND')
      const to = await getEntity(db, toId)
      if (to === null) throw batchError('entity-not-found (' + toId + ')', 'MEMORY_NOT_FOUND')
      const referrers = await deps.countReferrers(fromId, 'e')
      try {
        await deps.repointRefs(fromId, toId)
        await deleteEntity(db, fromId)
      } catch (error) {
        throw rowsToError(error)
      }
      return { from: fromId, to: toId, fromName: from.name, toName: to.name, rewritten: referrers }
    },
  }

  const updateRefs = {
    name: 'memory-update-refs',
    description: '把指向某 id 的引用整体改指到另一个 id（ent_* 或 mem_*）。不删除原对象。',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '原 id（ent_*/mem_*）' },
        to: { type: 'string', description: '新 id（ent_*/mem_*）' },
      },
      required: ['from', 'to'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          rewritten: { type: 'integer' },
          dangling: { type: 'integer', description: '因深度不变量未改指、保持悬空的条目数' },
        },
      },
      render(_args, value) {
        const lines = ['[memory-update-refs] from=' + value.from + ' to=' + value.to + ' rewritten=' + String(value.rewritten) + (value.dangling > 0 ? ' dangling=' + String(value.dangling) : '')]
        if (value.dangling > 0) {
          lines.push('hint: ' + String(value.dangling) + ' referrers left dangling (the target is not shallower — rebuild those entries or null their slot)')
        }
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const fromId = String(args.from)
      const toId = String(args.to)
      if (fromId === toId) throw batchError('bad-ref (from and to are the same id)')
      let result
      try {
        result = await deps.repointRefs(fromId, toId)
      } catch (error) {
        throw rowsToError(error)
      }
      return { from: fromId, to: toId, rewritten: result.rewritten, dangling: result.dangling }
    },
  }

  const bumpRecency = {
    name: 'memory-bump-recency',
    description: '刷新若干条记忆的「最近访问」时间。只改 last_access，不动访问计数。',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: '要刷新的条目 id 列表（mem_*）' },
      },
      required: ['ids'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          bumped: { type: 'integer' },
          ids: { type: 'array', items: { type: 'string' } },
        },
      },
      render(_args, value) {
        return textBlock('[memory-bump-recency] bumped=' + String(value.bumped))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const ids = [...new Set((Array.isArray(args.ids) ? args.ids : []).map((id) => String(id)))]
      if (ids.length === 0) throw batchError('bad-batch (pass at least one entry id)')
      const missing = []
      for (const id of ids) {
        if ((await getEntry(db, id)) === null) missing.push(id)
      }
      if (missing.length > 0) throw batchError('ref-missing (entries not found: ' + missing.join(', ') + ')', 'MEMORY_NOT_FOUND')
      const now = Date.now()
      for (const id of ids) await bumpRecencyEntry(db, id, now)
      return { bumped: ids.length, ids }
    },
  }

  return [mergeEntities, updateRefs, bumpRecency]
}