import { textBlock } from './memory/format.js'
import { deleteEntry, getEntry, listRefs, listReferrers, repointRefs, restoreEntry } from './memory/entries.js'
import { isValidScope, placeholderCount, scopeRank } from './memory/types.js'
import { MemoryValidationError } from './memory/validate.js'
import { mergeEntryStats } from './memory/stats.js'

const TYPE_RANK = { short: 0, long: 1, persona: 2 }
const SUPPORTED_TYPES = ['short', 'long', 'persona']

function invalid(message, code = 'MEMORY_INVALID_ARGUMENT') {
  return Object.assign(new Error(message), { code })
}

function notFound(message) {
  return Object.assign(new Error(message), { code: 'MEMORY_NOT_FOUND' })
}

function storeError(error) {
  if (error instanceof MemoryValidationError) {
    return Object.assign(new Error(error.message), { code: error.code, hint: error.hint })
  }
  return error
}

function toRefSlots(values) {
  return (Array.isArray(values) ? values : []).map((value) => {
    if (value === null || value === undefined) return { kind: 'e', id: null }
    const id = String(value)
    return { kind: id.startsWith('mem_') ? 'm' : 'e', id }
  })
}

export function createWriteTools(deps) {
  const db = deps.db

  const writeShort = {
    name: 'memory-write-short',
    description: '使用记忆模板和记忆实体创建一条短期记忆。模板必须有 {$n} 占位符，与 refs 按序一一对应。',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '命题形式的记忆模板，占位符 {$0}、{$1}… 依次对应 refs（如「{$0} 喜欢 {$1}」「{$1} 也喜欢 {$0}」）；最多 2000 字符',
        },
        refs: {
          type: 'array',
          description: '引用槽位，与模板中的占位符按 index 对应；元素为 ent_*/mem_* id 或 null（至少一个非 null，最多 8 个）',
          items: { oneOf: [{ type: 'string' }, { type: 'null' }] },
        },
        scope: {
          type: 'string',
          description: '记忆范围（省略 = global）：global / internal / collective:<id> / personal:<id>',
        },
        source: {
          type: 'string',
          description: '来源标识（自由文本，如 UserID 或 GroupID:UserID）；省略 = null',
        },
        origin_msg_ids: {
          type: 'array',
          description: '来源消息 id（仅作溯源记录，不校验是否存在）',
          items: { type: 'string' },
        },
      },
      required: ['content', 'refs'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['short'] },
          scope: { type: 'string' },
          refsUsed: { type: 'integer' },
          refsTotal: { type: 'integer' },
          source: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          depth: { type: 'integer' },
        },
      },
      render(_args, value) {
        return textBlock(
          '[memory-write-short] id=' + value.id + ' type=short scope=' + value.scope + ' refs=' + String(value.refsUsed) + '/' + String(value.refsTotal) + ' source=' + (value.source === null ? 'none' : value.source) + ' depth=' + String(value.depth),
        )
      },
    },
    isConcurrencySafe() {
      return true
    },
    async execute(args) {
      const refs = toRefSlots(args.refs)
      let id
      try {
        id = await deps.createEntry(db, {
          template: args.content,
          type: 'short',
          refs,
          scope: args.scope,
          source: args.source === undefined ? null : args.source,
          originMsgIds: Array.isArray(args.origin_msg_ids) ? args.origin_msg_ids.map((value) => String(value)) : undefined,
        })
      } catch (error) {
        throw storeError(error)
      }
      const entry = await getEntry(db, id)
      return {
        id,
        type: 'short',
        scope: entry === null ? 'global' : entry.scope,
        refsUsed: refs.filter((ref) => ref.id !== null).length,
        refsTotal: refs.length,
        source: args.source === undefined || args.source === null ? null : String(args.source),
        depth: entry === null ? 1 : entry.depth,
      }
    },
  }

  const deleteEntryTool = {
    name: 'memory-delete-entry',
    description: '删除若干条记忆（不可逆）。引用它们的条目会被标脏重嵌。',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: '要删除的条目 id 列表（mem_*）' },
      },
      required: ['ids'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          deleted: { type: 'integer' },
          referrers: { type: 'integer', description: '删除前引用这些条目的条目总数' },
          ids: { type: 'array', items: { type: 'string' } },
        },
      },
      render(_args, value) {
        return textBlock('[memory-delete-entry] deleted=' + String(value.deleted) + ' referrers=' + String(value.referrers))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const requested = Array.isArray(args.ids) ? args.ids.map((id) => String(id)) : []
      if (requested.length === 0) throw invalid('bad-batch (pass at least one entry id)')
      const ids = [...new Set(requested)]
      if (ids.length !== requested.length) throw invalid('duplicate-id (' + String(requested.length - ids.length) + ' id(s) listed twice)')
      const missing = []
      for (const id of ids) {
        if ((await getEntry(db, id)) === null) missing.push(id)
      }
      if (missing.length > 0) throw notFound('ref-missing (entries not found: ' + missing.join(', ') + ')')
      let referrers = 0
      for (const id of ids) referrers += await deps.countReferrers(id, 'm')
      try {
        for (const id of ids) await deleteEntry(db, id)
      } catch (error) {
        throw storeError(error)
      }
      return { deleted: ids.length, referrers, ids }
    },
  }

  const mergeEntries = {
    name: 'memory-merge-entries',
    description: '把多条相关记忆合并成一条新命题（默认删除来源条目；不可逆）。',
    parameters: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: '被合并的条目 id 列表（mem_*），至少 2 条' },
        content: { type: 'string', description: '新命题的记忆模板，占位符 {$0}、{$1}… 依次对应 refs' },
        refs: {
          type: 'array',
          description: '新命题的引用槽位，与模板占位符按序对应；元素为 ent_*/mem_* id 或 null（至少一个非 null）',
          items: { oneOf: [{ type: 'string' }, { type: 'null' }] },
        },
        type: { type: 'string', enum: SUPPORTED_TYPES, description: '新命题的类型（不得低于来源中的最高类型）' },
        scope: { type: 'string', description: '新命题的范围（global / internal / collective:<id> / personal:<id>；不得低于来源中最宽的范围，internal 除外）' },
        clear_old: { type: 'boolean', description: '合并后是否删除来源条目（默认 true）' },
      },
      required: ['ids', 'content', 'refs', 'type', 'scope'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: '新条目 id' },
          merged: { type: 'integer', description: '合并的源条目数' },
          clearOld: { type: 'boolean' },
          rewritten: { type: 'integer', description: '改指成功的引用者条目数' },
          dangling: { type: 'integer', description: '因深度不变量未改指、保持悬空的条目数' },
        },
      },
      render(_args, value) {
        const tail = value.clearOld
          ? ' rewritten=' + String(value.rewritten) + (value.dangling > 0 ? ' dangling=' + String(value.dangling) : '')
          : ' clear_old=false'
        const lines = ['[memory-merge-entries] id=' + value.id + ' merged=' + String(value.merged) + tail]
        if (value.dangling > 0) {
          lines.push('hint: ' + String(value.dangling) + ' referrers left dangling (the new entry is not shallower — rebuild those entries or null their slot)')
        }
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const clearOld = args.clear_old !== false
      const requested = Array.isArray(args.ids) ? args.ids.map((id) => String(id)) : []
      if (requested.length < 2) throw invalid('bad-merge (pass at least two entry ids)')
      const ids = [...new Set(requested)]
      if (ids.length !== requested.length) throw invalid('duplicate-id (' + String(requested.length - ids.length) + ' id(s) listed twice)')
      const entries = []
      for (const id of ids) {
        const entry = await getEntry(db, id)
        if (entry === null) throw notFound('ref-missing (entries not found: ' + id + ')')
        entries.push(entry)
      }
      if (!SUPPORTED_TYPES.includes(args.type)) throw invalid('bad-type (' + String(args.type) + '; allowed: short/long/persona)')
      const highest = entries.reduce((current, entry) => (TYPE_RANK[entry.type] > TYPE_RANK[current] ? entry.type : current), entries[0].type)
      if (TYPE_RANK[args.type] < TYPE_RANK[highest]) {
        throw invalid('bad-merge (type ' + args.type + ' is below the highest source type ' + highest + ' — the merged type must be ' + highest + ' or higher)')
      }
      if (!isValidScope(args.scope)) throw invalid('scope-invalid (' + String(args.scope) + '; only global / internal / collective:<id> / personal:<id>)')
      const widest = entries.reduce((current, entry) => (scopeRank(entry.scope) > scopeRank(current) ? entry.scope : current), entries[0].scope)
      if (args.scope !== 'internal' && scopeRank(args.scope) < scopeRank(widest)) {
        throw invalid('bad-merge (scope ' + args.scope + ' is narrower than the widest source scope ' + widest + '; only internal may be used as a narrowing)')
      }
      const refs = toRefSlots(args.refs)
      const needed = placeholderCount(args.content)
      if (refs.length !== needed) {
        throw invalid('ref-count-mismatch (refs has ' + String(refs.length) + ' slots but the template has ' + String(needed) + ' placeholders)')
      }
      if (clearOld) {
        const backRef = refs.find((ref) => ref.id !== null && ids.includes(ref.id))
        if (backRef !== undefined) {
          throw invalid('bad-ref (refs must not point at the merged entries when clear_old is on: ' + backRef.id + ' is about to be deleted)')
        }
      }

      const first = entries[0]
      const origins = [...new Set(entries.flatMap((entry) => (entry.originMsgIds === null ? [] : entry.originMsgIds)))]
      const createdAt = Math.min(...entries.map((entry) => entry.createdAt))
      const textRevision = Math.max(...entries.map((entry) => entry.textRevision)) + 1
      let newId
      try {
        newId = await restoreEntry(db, {
          ...first,
          id: null,
          template: args.content,
          type: args.type,
          scope: args.scope,
          source: null,
          originMsgIds: origins.length > 0 ? origins : null,
          createdAt,
          textRevision,
          vecRevision: 0,
        }, refs)
      } catch (error) {
        throw storeError(error)
      }
      for (const entry of entries.slice(1)) {
        await mergeEntryStats(db, newId, {
          cH5m: entry.cH5m,
          c1h: entry.c1h,
          c24h: entry.c24h,
          c7d: entry.c7d,
          totalAccess: entry.totalAccess,
          lastAccess: entry.lastAccess,
        })
      }
      let rewritten = 0
      let dangling = 0
      if (clearOld) {
        const sourceSet = new Set(ids)
        const referrers = new Set()
        for (const source of ids) {
          for (const referrer of await listReferrers(db, source, 'm')) {
            if (!sourceSet.has(referrer)) referrers.add(referrer)
          }
        }
        for (const source of ids) await repointRefs(db, source, newId)
        for (const referrer of referrers) {
          const slots = await listRefs(db, referrer)
          if (slots.some((slot) => slot.id === newId)) rewritten += 1
          else dangling += 1
        }
        for (const source of ids) await deleteEntry(db, source)
      }
      return { id: newId, merged: ids.length, clearOld, rewritten, dangling }
    },
  }

  return [writeShort, deleteEntryTool, mergeEntries]
}
