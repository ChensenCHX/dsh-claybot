function fillTemplate(template, refs, valueOf) {
  return String(template).replace(/\{\$(\d+)\}/g, (_match, slotText) => {
    const slot = refs[Number(slotText)]
    return slot ? valueOf(slot) : '[未知]'
  })
}

function entityValue(slot, names) {
  if (slot.ref_id === null || slot.ref_id === undefined) return '[未知]'
  return names.get(slot.ref_id) || '[Entity:' + String(slot.ref_id) + ']'
}

export class MemoryRenderer {
  constructor(db) {
    this.db = db
  }

  async rows(sql, values = []) {
    const result = await this.db.queryParams('memory', sql, values)
    return (result.results && result.results[0] && result.results[0].rows) || []
  }

  async expand(ids) {
    const out = new Map()
    const targets = [...new Set((ids || []).map((id) => String(id)))]
    if (targets.length === 0) return out

    const entries = await this.rows(
      'SELECT id, template FROM memory.memory_entries WHERE id = ANY($1::text[])',
      [targets],
    )
    const entryById = new Map(entries.map((entry) => [entry.id, entry]))
    const refs = await this.rows(
      'SELECT memory_id, ord, ref_kind, ref_id FROM memory.memory_entry_refs WHERE memory_id = ANY($1::text[]) ORDER BY memory_id, ord',
      [targets],
    )
    const refsBy = new Map()
    for (const ref of refs) {
      if (!refsBy.has(ref.memory_id)) refsBy.set(ref.memory_id, [])
      refsBy.get(ref.memory_id).push(ref)
    }

    const nestedIds = new Set()
    for (const list of refsBy.values()) {
      for (const ref of list) {
        if (ref.ref_id && ref.ref_kind === 'm') nestedIds.add(ref.ref_id)
      }
    }
    const nestedRefs = nestedIds.size
      ? await this.rows(
          'SELECT memory_id, ord, ref_kind, ref_id FROM memory.memory_entry_refs WHERE memory_id = ANY($1::text[]) ORDER BY memory_id, ord',
          [[...nestedIds]],
        )
      : []
    const nestedRefsBy = new Map()
    for (const ref of nestedRefs) {
      if (!nestedRefsBy.has(ref.memory_id)) nestedRefsBy.set(ref.memory_id, [])
      nestedRefsBy.get(ref.memory_id).push(ref)
    }

    const entityIds = new Set()
    for (const list of [...refsBy.values(), ...nestedRefsBy.values()]) {
      for (const ref of list) {
        if (ref.ref_id && ref.ref_kind === 'e') entityIds.add(ref.ref_id)
      }
    }
    const entities = entityIds.size
      ? await this.rows('SELECT id, name FROM memory.memory_entities WHERE id = ANY($1::text[])', [[...entityIds]])
      : []
    const entityNames = new Map(entities.map((entity) => [entity.id, entity.name]))

    const nestedEntries = nestedIds.size
      ? await this.rows('SELECT id, template FROM memory.memory_entries WHERE id = ANY($1::text[])', [[...nestedIds]])
      : []
    const nestedText = new Map()
    for (const entry of nestedEntries) {
      nestedText.set(
        entry.id,
        fillTemplate(entry.template, nestedRefsBy.get(entry.id) || [], (slot) => {
          if (slot.ref_kind === 'e') return entityValue(slot, entityNames)
          return slot.ref_id ? '[Memory:' + String(slot.ref_id) + ']' : '[未知]'
        }),
      )
    }

    for (const entry of entries) {
      out.set(
        entry.id,
        fillTemplate(entry.template, refsBy.get(entry.id) || [], (slot) => {
          if (slot.ref_kind === 'e') return entityValue(slot, entityNames)
          if (!slot.ref_id) return '[未知]'
          return nestedText.get(slot.ref_id) || '[Memory:' + String(slot.ref_id) + ']'
        }),
      )
    }
    return out
  }
}
