import { MAX_DEPTH, MAX_REFS, NAME_MAX, TEMPLATE_MAX, canReference, isValidScope, placeholderCount } from './types.js'

export const REF_KIND_ENTITY = 'e'
export const REF_KIND_MEMORY = 'm'

export class MemoryValidationError extends Error {
  constructor(code, message, hint) {
    super(message)
    this.name = 'MemoryValidationError'
    this.code = code
    if (hint !== undefined) this.hint = hint
  }
}

function slotRef(id) {
  return String(id).startsWith('mem_') ? REF_KIND_MEMORY : REF_KIND_ENTITY
}

async function checkSlot(db, selfType, ord, slot) {
  if (slot.id === null || slot.id === undefined) return { depth: 0 }
  if (slot.kind === REF_KIND_ENTITY) {
    const result = await db.queryParams('memory', 'SELECT id FROM memory.memory_entities WHERE id = $1', [slot.id])
    const rows = (result.results && result.results[0] && result.results[0].rows) || []
    if (rows.length === 0) {
      return {
        error: {
          code: 'ref-missing',
          message: 'slot ' + String(ord) + ' references entity ' + String(slot.id) + ', which does not exist (create it first with create-entity, or set the slot to null)',
        },
      }
    }
    return { depth: 0 }
  }
  const result = await db.queryParams('memory', 'SELECT id, type, depth FROM memory.memory_entries WHERE id = $1', [slot.id])
  const rows = (result.results && result.results[0] && result.results[0].rows) || []
  if (rows.length === 0) {
    return {
      error: {
        code: 'ref-missing',
        message: 'slot ' + String(ord) + ' references entry ' + String(slot.id) + ', which does not exist (refs must point at existing entries, or use null)',
      },
    }
  }
  const target = rows[0]
  if (!canReference(selfType, target.type)) {
    return {
      error: {
        code: 'type-lattice',
        message: 'slot ' + String(ord) + ': ' + String(selfType) + ' cannot reference ' + String(target.type) + ' (references only go upward: short→short/long/persona, long→long/persona, persona→persona)',
      },
    }
  }
  return { depth: Number(target.depth) }
}

export async function checkNewEntry(db, input) {
  const template = input.template === undefined || input.template === null ? '' : String(input.template)
  if (template.trim() === '') return { ok: false, error: { code: 'template-empty', message: 'template must not be empty' } }
  if (template.length > TEMPLATE_MAX) {
    return {
      ok: false,
      error: { code: 'template-too-long', message: 'template is ' + String(template.length) + ' chars, over the ' + String(TEMPLATE_MAX) + ' limit (tighten it or split into several claims)' },
    }
  }
  const placeholders = placeholderCount(template)
  if (placeholders === 0) {
    return {
      ok: false,
      error: { code: 'no-placeholder', message: 'template needs at least one placeholder like {$0} (free prose is not an entry — put the subject into a ref)' },
    }
  }
  const refs = Array.isArray(input.refs) ? input.refs : []
  if (refs.length !== placeholders) {
    return {
      ok: false,
      error: {
        code: 'ref-count-mismatch',
        message: 'refs has ' + String(refs.length) + ' slots but the template has ' + String(placeholders) + ' placeholders — they must match one-to-one (slots may be null; the length is fixed)',
      },
    }
  }
  if (refs.length > MAX_REFS) {
    return { ok: false, error: { code: 'ref-capacity', message: 'refs has ' + String(refs.length) + ' slots, over the ' + String(MAX_REFS) + ' limit (split into several claims)' } }
  }
  if (refs.every((ref) => ref.id === null || ref.id === undefined)) {
    return { ok: false, error: { code: 'all-refs-null', message: 'at least one ref must be non-null (all-null means no subject)' } }
  }

  let maxDepth = 0
  for (let ord = 0; ord < refs.length; ord += 1) {
    const result = await checkSlot(db, input.type, ord, refs[ord])
    if (result.error) return { ok: false, error: result.error }
    maxDepth = Math.max(maxDepth, result.depth)
  }
  const depth = maxDepth + 1
  if (depth > MAX_DEPTH + 1) {
    return {
      ok: false,
      error: {
        code: 'depth-exceeded',
        message: 'this would land at depth ' + String(depth) + ', over the ' + String(MAX_DEPTH + 1) + '-layer limit — reference shallower entries, or rebuild the referenced one',
      },
    }
  }

  const originMsgIds = Array.isArray(input.originMsgIds) && input.originMsgIds.length > 0 ? input.originMsgIds.map((id) => String(id)) : null
  let scope = 'global'
  if (input.scope !== undefined && input.scope !== null) {
    scope = String(input.scope)
    if (!isValidScope(scope)) {
      return {
        ok: false,
        error: {
          code: 'scope-invalid',
          message: 'scope "' + scope + '" is invalid: use global, internal, collective:<id>, or personal:<id>',
        },
      }
    }
  }
  return { ok: true, depth, scope, originMsgIds }
}

export async function checkSlotUpdate(db, self, ord, slot) {
  if (ord < 0 || ord >= MAX_REFS) {
    return { code: 'ref-capacity', message: 'slot index ' + String(ord) + ' is out of range (0..' + String(MAX_REFS - 1) + ')' }
  }
  const result = await checkSlot(db, self.type, ord, slot)
  if (result.error) return result.error
  if (slot.kind === REF_KIND_MEMORY && slot.id !== null && slot.id !== undefined) {
    const query = await db.queryParams('memory', 'SELECT depth FROM memory.memory_entries WHERE id = $1', [slot.id])
    const rows = (query.results && query.results[0] && query.results[0].rows) || []
    if (rows.length > 0 && Number(rows[0].depth) >= Number(self.depth)) {
      return {
        code: 'depth-exceeded',
        message: 'slot ' + String(ord) + ': target depth ' + String(rows[0].depth) + ' >= this entry\'s depth ' + String(self.depth) + ' would create a cycle / exceed layers (only reference shallower entries)',
      }
    }
  }
  return null
}

export function checkEntityName(name) {
  const value = name === undefined || name === null ? '' : String(name)
  if (value.trim() === '') return { code: 'empty-name', message: 'entity name must not be empty' }
  if (value.length > NAME_MAX) return { code: 'name-too-long', message: 'entity name is ' + String(value.length) + ' chars, over the ' + String(NAME_MAX) + ' limit' }
  return null
}

export function toRefSlots(values) {
  const list = Array.isArray(values) ? values : []
  return list.map((value) => {
    if (value === null || value === undefined) return { kind: REF_KIND_ENTITY, id: null }
    const id = String(value)
    const kind = slotRef(id)
    return { kind, id }
  })
}
