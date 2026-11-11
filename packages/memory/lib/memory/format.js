import { formatAge, formatTimestamp } from './types.js'

export { formatAge, formatTimestamp }

export function textBlock(text) {
  return [{ type: 'text', text }]
}

export function clampInteger(value, fallback, min, max) {
  const number = Number(value)
  const base = Number.isFinite(number) ? Math.trunc(number) : fallback
  return Math.min(Math.max(base, min), max)
}
