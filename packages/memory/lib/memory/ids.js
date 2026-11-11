const ID_HEX_WIDTH = 8

export function scrambleId(value) {
  const n = Number(value) >>> 0
  const x = Math.imul(n, 0x9e3779b1) >>> 0
  const y = (x ^ (x >>> 16)) >>> 0
  return y.toString(16).padStart(ID_HEX_WIDTH, '0')
}

export function entityId(seq) {
  return 'ent_' + scrambleId(seq)
}

export function entryId(seq) {
  return 'mem_' + scrambleId(seq)
}

export function messageId(seq) {
  return 'msg_' + scrambleId(seq)
}

export function isEntityId(value) {
  return typeof value === 'string' && /^ent_[0-9a-f]{8}$/.test(value)
}

export function isEntryId(value) {
  return typeof value === 'string' && /^mem_[0-9a-f]{8}$/.test(value)
}

export function isMessageId(value) {
  return typeof value === 'string' && /^msg_[0-9a-f]{8}$/.test(value)
}

export const ID_TABLES = {
  entity: { table: 'memory.memory_entities', prefix: 'ent_', build: entityId },
  entry: { table: 'memory.memory_entries', prefix: 'mem_', build: entryId },
}
