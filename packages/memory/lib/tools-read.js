import { getEntitiesByIds } from './memory/entities.js'
import { countReferrers, getEntry, listRefs, listReferencingEntries } from './memory/entries.js'
import { getSettledCounters, touchEntries } from './memory/stats.js'
import { recallEntries } from './memory/search.js'
import { formatAge, formatTimestamp } from './memory/types.js'
import { clampInteger, textBlock } from './memory/format.js'

const READ_ENTRY_MAX_IDS = 8

function f2(value) {
  return Number(value).toFixed(2)
}

export function createReadTools(deps) {
  const db = deps.db

  const recall = {
    name: 'memory-recall',
    description: '使用自然语言按语义检索记忆。返回按相似度排序的记忆条目；可用 entities 限定必须包含的实体，用 types 限定记忆类型。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '用于查询的自然语言描述' },
        entities: {
          type: 'array',
          description: '用于过滤结果的记忆实体，结果一定包含所指定的全部实体；可传 ent_* id 或实体名，默认无过滤',
          items: { type: 'string' },
        },
        types: {
          type: 'array',
          description: '用于过滤结果的记忆类型，默认无过滤',
          items: { type: 'string', enum: ['short', 'long', 'persona'] },
        },
        maxK: { type: 'number', description: '返回条数上限，最大 24 条，默认 8 条' },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          maxK: { type: 'integer' },
          types: { type: 'array', items: { type: 'string' } },
          degraded: { type: 'string', enum: ['embedding-unavailable'] },
          filter: {
            type: 'object',
            additionalProperties: false,
            properties: {
              resolved: { type: 'array', items: { type: 'string' } },
              unresolved: { type: 'array', items: { type: 'string' } },
              passed: { type: 'integer' },
            },
          },
          hits: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['short', 'long', 'persona'] },
                scope: { type: 'string' },
                createdAt: { type: 'string', description: 'ISO 8601 时间' },
                score: { type: 'number', description: '余弦相似度；降级时省略' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
      render(args, value) {
        const lines = [
          '[memory-recall] hits=' + String(value.hits.length) + ' maxK=' + String(value.maxK) + ' types=' + value.types.join(','),
        ]
        if (value.filter !== undefined) {
          lines[0] += ' entities=[' + value.filter.resolved.join(',') + '] pass=' + String(value.filter.passed)
          if (value.filter.unresolved.length > 0) {
            lines.push('unresolved-entities: [' + value.filter.unresolved.join(', ') + '] (use memory-entity-search to get ent_* ids)')
          }
        }
        if (value.hits.length > 0) lines.push('columns: rank | type | scope | id | score | created_at | text')
        value.hits.forEach((hit, index) => {
          const score = hit.score === undefined || hit.score === null ? '—' : Number(hit.score).toFixed(4)
          lines.push(String(index + 1) + ' | ' + hit.type + ' | ' + hit.scope + ' | ' + hit.id + ' | ' + score + ' | ' + formatTimestamp(hit.createdAt) + ' | ' + hit.text)
        })
        if (value.degraded !== undefined) lines.push('degraded: ' + value.degraded + ' fallback=activity-order')
        if (value.hits.length === 0) lines.push('hint: loosen types or drop entities and retry')
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      const result = await recallEntries(
        {
          db,
          dimensions: deps.dimensions,
          embedText: deps.embedText,
          expand: deps.expand,
        },
        {
          query: args.query,
          entities: args.entities,
          types: args.types,
          maxK: args.maxK,
        },
      )
      return result
    },
  }

  const entitySearch = {
    name: 'memory-entity-search',
    description: '使用实体名片段模糊检索记忆实体。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '用于查询的实体名片段' },
        limit: { type: 'number', description: '返回条数上限，最大 50 条，默认 20 条' },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          hits: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                createdAt: { type: 'string' },
                directRefs: { type: 'integer' },
              },
            },
          },
        },
      },
      render(_args, value) {
        const lines = ['[memory-entity-search] hits=' + String(value.hits.length)]
        value.hits.forEach((hit, index) => {
          lines.push(String(index + 1) + ' | ' + hit.id + ' | ' + hit.name + ' | direct_refs=' + String(hit.directRefs) + ' | ' + hit.createdAt)
        })
        if (value.hits.length === 0) lines.push('hint: try another name fragment (fuzzy match)')
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      const limit = clampInteger(args.limit, 20, 1, 50)
      const entities = await deps.searchEntities(args.query, limit)
      const hits = []
      for (const entity of entities) {
        hits.push({
          id: entity.id,
          name: entity.name,
          createdAt: formatTimestamp(entity.createdAt),
          directRefs: await countReferrers(db, entity.id, 'e'),
        })
      }
      return { hits }
    },
  }

  const readEntry = {
    name: 'memory-read-entry',
    description: '按 id 批量读取记忆条目。',
    parameters: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          description: '用于查询的记忆条目 id 列表（mem_*），单次最多 8 条，超出截断',
          items: { type: 'string' },
        },
      },
      required: ['ids'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          count: { type: 'integer' },
          found: { type: 'integer' },
          dropped: { type: 'integer' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                ok: { type: 'boolean' },
                error: { type: 'string', description: 'bad-id / entry-not-found' },
                type: { type: 'string', enum: ['short', 'long', 'persona'] },
                scope: { type: 'string' },
                depth: { type: 'integer' },
                template: { type: 'string' },
                refs: {
                  type: 'array',
            items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      ord: { type: 'integer' },
                      kind: { type: 'string', enum: ['e', 'm'] },
                      id: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                      name: { type: 'string' },
                    },
                  },
                },
                createdAt: { type: 'string' },
                stats: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    totalAccess: { type: 'integer' },
                    lastAccess: { type: 'string', description: '多久以前，如 3.14m' },
                    c5m: { type: 'number' },
                    c1h: { type: 'number' },
                    c24h: { type: 'number' },
                    c7d: { type: 'number' },
                  },
                },
                source: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                originMsgIds: { type: 'array', items: { type: 'string' } },
                stale: { type: 'boolean', description: '待嵌时为 true' },
              },
            },
          },
        },
      },
      render(_args, value) {
        const lines = ['[memory-read-entry] count=' + String(value.count) + ' found=' + String(value.found) + (value.dropped === undefined ? '' : ' dropped=' + String(value.dropped))]
        for (const entry of value.entries) {
          if (!entry.ok) {
            lines.push('--- ' + entry.id + ' | error: ' + entry.error)
            continue
          }
          lines.push('--- ' + entry.id + ' | ' + entry.type + ' | depth=' + String(entry.depth) + ' | scope=' + entry.scope)
          lines.push('created_at: ' + entry.createdAt)
          lines.push('template: ' + entry.template)
          const refText = entry.refs.length === 0
            ? '(none)'
            : entry.refs.map((ref) => (ref.id === null ? String(ref.ord) + '=null' : ref.kind === 'e' ? String(ref.ord) + '=' + ref.id + '(' + (ref.name === undefined ? '?' : ref.name) + ')' : String(ref.ord) + '=' + ref.id + '(memory)')).join(' ')
          lines.push('refs: ' + refText)
          lines.push('stats: total_access=' + String(entry.stats.totalAccess) + ' last_access=' + entry.stats.lastAccess + ' c5m=' + f2(entry.stats.c5m) + ' c1h=' + f2(entry.stats.c1h) + ' c24h=' + f2(entry.stats.c24h) + ' c7d=' + f2(entry.stats.c7d))
          lines.push('source: ' + String(entry.source) + ' | origin_msg_ids=' + String(entry.originMsgIds.length) + (entry.originMsgIds.length > 0 ? ' [' + entry.originMsgIds.join(', ') + ']' : ''))
          if (entry.stale === true) lines.push('vector: stale (pending re-embed)')
        }
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      const requested = Array.isArray(args.ids) ? args.ids : []
      const ids = requested.slice(0, READ_ENTRY_MAX_IDS)
      const dropped = requested.length - ids.length
      const now = Date.now()
      const blocks = []
      const pending = []
      for (const raw of ids) {
        const id = String(raw)
        if (!id.startsWith('mem_')) {
          blocks.push({ id, ok: false, error: 'bad-id' })
          continue
        }
        const entry = await getEntry(db, id)
        if (entry === null) {
          blocks.push({ id, ok: false, error: 'entry-not-found' })
          continue
        }
        pending.push({ index: blocks.length, entry })
        blocks.push(null)
      }
      const counters = new Map()
      for (const item of pending) {
        counters.set(item.entry.id, await getSettledCounters(db, item.entry.id, now))
      }
      await touchEntries(db, pending.map((item) => item.entry.id), now)
      for (const item of pending) {
        const entry = item.entry
        const refs = await listRefs(db, entry.id)
        const entityIds = refs.filter((ref) => ref.kind === 'e' && ref.id !== null).map((ref) => ref.id)
        const entities = await getEntitiesByIds(db, entityIds)
        const names = new Map(entities.map((entity) => [entity.id, entity.name]))
        const settled = counters.get(entry.id) || { c5m: 0, c1h: 0, c24h: 0, c7d: 0 }
        blocks[item.index] = {
          id: entry.id,
          ok: true,
          type: entry.type,
          scope: entry.scope,
          depth: entry.depth,
          template: entry.template,
          refs: refs.map((ref) => ({ ord: ref.ord, kind: ref.kind, id: ref.id, name: ref.id !== null && ref.kind === 'e' ? names.get(ref.id) : undefined })),
          createdAt: formatTimestamp(entry.createdAt),
          stats: {
            totalAccess: entry.totalAccess,
            lastAccess: formatAge(entry.lastAccess, now),
            c5m: settled.c5m,
            c1h: settled.c1h,
            c24h: settled.c24h,
            c7d: settled.c7d,
          },
          source: entry.source === null || entry.source === undefined ? null : String(entry.source),
          originMsgIds: entry.originMsgIds === null ? [] : entry.originMsgIds.map((value) => String(value)),
          stale: entry.vecRevision < entry.textRevision,
        }
      }
      const found = pending.length
      const result = { count: ids.length, found, entries: blocks }
      if (dropped > 0) result.dropped = dropped
      return result
    },
  }

  const readEntity = {
    name: 'memory-read-entity',
    description: '按 id 查看记忆实体的档案。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '用于查询的实体 id（ent_*，如 ent_b54c6f6a）' },
        maxK: { type: 'number', description: '返回引用条目数上限，最大 24 条，省略或 0 表示只统计不返回' },
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
          createdAt: { type: 'string' },
          directRefs: { type: 'integer' },
          returned: { type: 'integer' },
          remaining: { type: 'integer' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                type: { type: 'string', enum: ['short', 'long', 'persona'] },
                scope: { type: 'string' },
                createdAt: { type: 'string' },
                text: { type: 'string' },
              },
            },
          },
        },
      },
      render(_args, value) {
        const lines = [
          '[memory-read-entity] id=' + value.id + ' name=' + value.name + ' created_at=' + value.createdAt + ' direct_refs=' + String(value.directRefs),
        ]
        if (value.returned > 0) {
          lines[0] += ' returned=' + String(value.returned) + ' order=last_access.desc'
          lines.push('columns: rank | type | scope | id | created_at | text')
          value.entries.forEach((entry, index) => {
            lines.push(String(index + 1) + ' | ' + entry.type + ' | ' + entry.scope + ' | ' + entry.id + ' | ' + entry.createdAt + ' | ' + entry.text)
          })
        }
        if (value.remaining > 0) lines.push('remaining: ' + String(value.remaining))
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      const id = String(args.id)
      const entity = await deps.getEntity(id)
      if (entity === null) {
        throw Object.assign(new Error('entity-not-found (' + id + ')'), { code: 'MEMORY_NOT_FOUND' })
      }
      const maxK = clampInteger(args.maxK, 0, 0, 24)
      const direct = await countReferrers(db, entity.id, 'e')
      if (maxK <= 0) {
        return {
          id: entity.id,
          name: entity.name,
          createdAt: formatTimestamp(entity.createdAt),
          directRefs: direct,
          returned: 0,
          remaining: direct,
          entries: [],
        }
      }
      const referencing = await listReferencingEntries(db, entity.id, { kind: 'e', limit: maxK })
      const texts = await deps.expand(referencing.entries.map((entry) => entry.id))
      await touchEntries(db, referencing.entries.map((entry) => entry.id))
      return {
        id: entity.id,
        name: entity.name,
        createdAt: formatTimestamp(entity.createdAt),
        directRefs: referencing.total,
        returned: referencing.entries.length,
        remaining: Math.max(0, referencing.total - referencing.entries.length),
        entries: referencing.entries.map((entry) => ({
          id: entry.id,
          type: entry.type,
          scope: entry.scope,
          createdAt: formatTimestamp(entry.createdAt),
          text: texts.get(entry.id) === undefined ? entry.template : texts.get(entry.id),
        })),
      }
    },
  }

  return [recall, entitySearch, readEntry, readEntity]
}
