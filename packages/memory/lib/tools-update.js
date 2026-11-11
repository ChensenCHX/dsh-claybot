import { textBlock } from './memory/format.js'
import { deleteEntry, getEntry, listRefs, listReferencingEntries, repointRefs, restoreEntry, setRefSlot, setScope } from './memory/entries.js'
import { canReference, isValidScope, placeholderCount } from './memory/types.js'
import { MemoryValidationError } from './memory/validate.js'
import { getEntryVector, upsertEntryVector } from './memory/vec.js'

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

function toRefSlot(value) {
  if (value === null || value === undefined) return { kind: 'e', id: null }
  const id = String(value)
  return { kind: id.startsWith('mem_') ? 'm' : 'e', id }
}

async function applyUpdate(db, deps, id, patch, force) {
  const old = await getEntry(db, id)
  if (old === null) throw notFound('ref-missing (entry ' + id + ' does not exist)')
  const template = patch.template === undefined ? old.template : String(patch.template)
  const needed = placeholderCount(template)
  const current = await listRefs(db, id)
  const templateChanged = patch.template !== undefined && patch.template !== old.template
  const slots = []
  const slotChanges = []
  const updates = Array.isArray(patch.refs) ? patch.refs : []
  for (let index = 0; index < needed; index += 1) {
    const update = updates.find((item) => Number(item.index) === index)
    const previous = current[index]
    if (update === undefined) {
      slots.push(previous === undefined ? { kind: 'e', id: null } : { kind: previous.kind, id: previous.id })
      continue
    }
    const nextId = update.new_id === undefined || update.new_id === null ? null : String(update.new_id)
    const kind = nextId === null ? (previous === undefined ? 'e' : previous.kind) : nextId.startsWith('mem_') ? 'm' : 'e'
    slots.push({ kind, id: nextId })
    if ((previous === undefined ? null : previous.id) !== nextId) {
      slotChanges.push({ index, from: previous === undefined ? null : previous.id, to: nextId })
    }
  }
  const type = patch.type === undefined ? old.type : String(patch.type)
  const scope = patch.scope === undefined ? old.scope : String(patch.scope)
  const rebuilt = templateChanged || type !== old.type

  if (!rebuilt) {
    if (slots.every((slot) => slot.id === null)) throw invalid('all-refs-null (at least one ref must be non-null (all-null means no subject))')
    if (slots.length !== current.length) {
      throw invalid('ref-count-mismatch (slot count changes require a template change: current ' + String(current.length) + ' slots, template needs ' + String(slots.length) + ')')
    }
    for (let index = 0; index < slots.length; index += 1) {
      const previous = current[index]
      const next = slots[index]
      if (previous !== undefined && previous.kind === next.kind && previous.id === next.id) continue
      try {
        await setRefSlot(db, id, index, next)
      } catch (error) {
        throw storeError(error)
      }
    }
    if (scope !== old.scope) {
      if (!isValidScope(scope)) throw invalid('scope-invalid (' + scope + '; only global / internal / collective:<id> / personal:<id>)')
      await setScope(db, id, scope)
    }
    return { id, rebuilt: false, nulled: 0, slotChanges, note: null }
  }

  if (scope !== old.scope && !isValidScope(scope)) {
    throw invalid('scope-invalid (' + scope + '; only global / internal / collective:<id> / personal:<id>)')
  }
  const textSame = !templateChanged && slots.every((slot, index) => (current[index] === undefined ? null : current[index].id) === (slot.id === undefined ? null : slot.id))
  const carried = textSame ? await getEntryVector(db, id) : null
  const referrers = await listReferencingEntries(db, id, { kind: 'm', limit: 50 })
  const breaking = referrers.entries.filter((referrer) => !canReference(referrer.type, type))
  if (breaking.length > 0 && !force) {
    const names = breaking.map((referrer) => referrer.id + '(' + referrer.type + ')').join(', ')
    const error = new MemoryValidationError(
      'type-lattice',
      'referrers cannot reference ' + type + ': ' + names + ' — rebuild or repoint them first',
      'hint: pass force=true to null their slots instead (the link is dropped, nothing dangles). Only use force when the narrowing is intended; it silently removes those links.',
    )
    throw storeError(error)
  }
  let next
  try {
    next = await restoreEntry(db, {
      ...old,
      id: null,
      template,
      type,
      scope,
      textRevision: templateChanged ? old.textRevision + 1 : old.textRevision,
      vecRevision: textSame ? old.vecRevision : 0,
    }, slots)
  } catch (error) {
    throw storeError(error)
  }
  if (carried !== null) await upsertEntryVector(db, next, type, carried, Number(deps.dimensions()))
  let nulled = 0
  for (const referrer of breaking) {
    for (const slot of await listRefs(db, referrer.id)) {
      if (slot.id !== id) continue
      await setRefSlot(db, referrer.id, slot.ord, { kind: slot.kind, id: null })
      nulled += 1
    }
  }
  await repointRefs(db, id, next)
  await deleteEntry(db, id)
  return {
    id: next,
    rebuilt: true,
    oldId: id,
    nulled,
    slotChanges,
    note: templateChanged && current.length !== needed ? 'slots: ' + String(current.length) + ' -> ' + String(needed) : null,
  }
}

export function createUpdateTools(deps) {
  const db = deps.db

  const updateEntry = {
    name: 'memory-update-entry',
    description: '更新某条记忆。只改 refs/scope 时原地更新（id 不变）；改模板或类型时删除旧条目并新建条目（id 会变，引用者自动改指，统计继承）。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '条目 id（mem_*，如 mem_8ff3c8ca）' },
        content: { type: 'string', description: '新的命题形式的记忆模板，占位符 {$0}、{$1}… 依次对应 refs（省略则沿用原模板）' },
        refs: {
          type: 'array',
          description: '需要更改的 槽位-id 对（未列出的沿用原值；new_id 省略或 null = 置空该槽位）',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              index: { type: 'integer', description: '槽位序号（0 起）' },
              new_id: { oneOf: [{ type: 'string' }, { type: 'null' }], description: '新的 ent_*/mem_* id；null = 置空该槽位' },
            },
            required: ['index'],
          },
        },
        type: { type: 'string', enum: SUPPORTED_TYPES, description: '新的类型（省略则沿用；改动 = 换新 id）' },
        scope: { type: 'string', description: '新的范围（省略则沿用；global / internal / collective:<id> / personal:<id>）' },
        force: {
          type: 'boolean',
          description: '仅用于类型降档等无法避免的场景：冲突的引用者槽位会被**静默置空**（返回 nulled 计数）。默认 false = 整体拒绝并列出冲突者。不要为了绕过报错而随手开启，先考虑先 repoint/重建引用者。',
        },
      },
      required: ['id'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: '更新后的条目 id（重建时会变化）' },
          rebuilt: { type: 'boolean' },
          oldId: { type: 'string', description: '重建时的原 id' },
          nulled: { type: 'integer', description: '重建时被置空的引用者槽位数' },
          slotChanges: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                index: { type: 'integer' },
                from: { oneOf: [{ type: 'string' }, { type: 'null' }] },
                to: { oneOf: [{ type: 'string' }, { type: 'null' }] },
              },
            },
          },
          note: { type: 'string', description: '如 slots: 2 -> 3' },
        },
      },
      render(_args, value) {
        const lines = [
          value.rebuilt
            ? '[memory-update-entry] old=' + value.oldId + ' new=' + value.id + (value.nulled > 0 ? ' nulled=' + String(value.nulled) : '')
            : '[memory-update-entry] id=' + value.id,
        ]
        const changes = value.slotChanges.slice().sort((left, right) => left.index - right.index)
        for (const change of changes) {
          lines.push('slot ' + String(change.index) + ': ' + (change.from === null ? 'null' : change.from) + ' -> ' + (change.to === null ? 'null' : change.to))
        }
        if (value.note !== undefined && value.note !== null) lines.push('# note: ' + value.note)
        if (value.nulled > 0) lines.push('# warning: ' + String(value.nulled) + ' referrer slot(s) were nulled because force=true')
        return textBlock(lines.join('\n'))
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const id = String(args.id)
      const type = args.type === undefined ? undefined : String(args.type)
      if (type !== undefined && !SUPPORTED_TYPES.includes(type)) {
        throw invalid('bad-type (' + type + '; allowed: short/long/persona)')
      }
      const current = await getEntry(db, id)
      if (current === null) throw notFound('ref-missing (entry ' + id + ' does not exist)')
      const needed = placeholderCount(args.content === undefined ? current.template : args.content)
      const seen = new Set()
      for (const update of Array.isArray(args.refs) ? args.refs : []) {
        const index = Number(update.index)
        if (!Number.isInteger(index) || index < 0 || index >= needed) {
          throw invalid('bad-index (' + String(update.index) + '; the template needs ' + String(needed) + ' slots, indexes 0..' + String(Math.max(0, needed - 1)) + ')')
        }
        if (seen.has(index)) throw invalid('duplicate-index (' + String(index) + '; list each slot at most once)')
        seen.add(index)
      }
      const currentRefs = await listRefs(db, id)
      const updates = Array.isArray(args.refs) ? args.refs : []
      const refsChanged = updates.some((update) => {
        const previous = currentRefs[Number(update.index)]
        const previousId = previous === undefined ? null : previous.id
        const nextId = update.new_id === undefined ? null : update.new_id === null ? null : String(update.new_id)
        return previousId !== nextId
      })
      const unchanged =
        (args.content === undefined || args.content === current.template) &&
        (args.type === undefined || type === current.type) &&
        (args.scope === undefined || args.scope === current.scope) &&
        !refsChanged
      if (unchanged) {
        throw invalid('no-op (nothing would change — pass content/refs/type/scope; for a recency refresh use memory-bump-recency)')
      }
      return applyUpdate(db, deps, id, { template: args.content, type, scope: args.scope, refs: updates }, args.force === true)
    },
  }

  return [updateEntry]
}
