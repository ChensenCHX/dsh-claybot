export const MAX_REFS = 8
export const MAX_DEPTH = 1
export const NAME_MAX = 64
export const TEMPLATE_MAX = 2000
export const STATE_KEY_WATERMARK = 'watermark_last_access'

export const ENTRY_TYPES = ['short', 'long', 'persona']
export const ALL_TYPES = ['short', 'long', 'persona']

export const RECALL_MAXK_DEFAULT = 8
export const RECALL_MAXK_LIMIT = 24

const LATTICE = {
  short: ['short', 'long', 'persona'],
  long: ['long', 'persona'],
  persona: ['persona'],
}

export function canReference(from, to) {
  return LATTICE[from] !== undefined && LATTICE[from].includes(to)
}

export function placeholderCount(template) {
  return (String(template).match(/\{\$\d+\}/g) || []).length
}

export const SCOPE_KINDS = ['global', 'internal', 'collective', 'personal']

export function scopeRank(scope) {
  const value = String(scope === undefined || scope === null ? '' : scope)
  if (value === 'internal') return 0
  if (value === 'global') return 2
  return 1
}

export function isValidScope(scope) {
  const value = String(scope === undefined || scope === null ? '' : scope).trim()
  if (value === 'global' || value === 'internal') return true
  return /^(collective|personal):\S{1,120}$/.test(value)
}

export function isEntryType(value) {
  return ENTRY_TYPES.includes(value)
}

const HOUR_MS = 3600000
const DAY_MS = 86400000
const MONTH_MS = 2592000000
const YEAR_MS = 31536000000

function pad(value, length = 2) {
  return String(Math.abs(value)).padStart(length, '0')
}

export function formatTimestamp(ms) {
  const value = Number(ms)
  if (!Number.isFinite(value)) return '—'
  const date = new Date(value)
  const offsetMinutes = -date.getTimezoneOffset()
  if (!Number.isFinite(offsetMinutes)) return '—'
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const offset = sign + pad(Math.floor(Math.abs(offsetMinutes) / 60)) + ':' + pad(Math.abs(offsetMinutes) % 60)
  const local = new Date(value + offsetMinutes * 60000)
  return (
    String(local.getUTCFullYear()) +
    '-' + pad(local.getUTCMonth() + 1) +
    '-' + pad(local.getUTCDate()) +
    'T' + pad(local.getUTCHours()) +
    ':' + pad(local.getUTCMinutes()) +
    ':' + pad(local.getUTCSeconds()) +
    offset
  )
}

export function formatAge(ms, now = Date.now()) {
  const diff = Math.max(0, now - Number(ms))
  if (!Number.isFinite(diff)) return '—'
  const seconds = diff / 1000
  if (seconds < 60) return seconds.toFixed(2) + 's'
  const minutes = diff / 60000
  if (minutes < 60) return minutes.toFixed(2) + 'm'
  const hours = diff / HOUR_MS
  if (hours < 24) return hours.toFixed(2) + 'h'
  const days = diff / DAY_MS
  if (days < 30) return days.toFixed(2) + 'd'
  const months = diff / MONTH_MS
  if (months < 12) return months.toFixed(2) + 'mo'
  return (diff / YEAR_MS).toFixed(2) + 'y'
}
