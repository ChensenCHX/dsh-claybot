import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const GRANTS_FILE = 'tool-grants.json'
const VERSION = 1

export function claybotStateDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return process.env.CLAYBOT_STATE_DIR || path.join(home, 'claybot')
}

export function grantsPath() {
  return path.join(claybotStateDir(), GRANTS_FILE)
}

function emptyStore() {
  return { version: VERSION, sessions: {} }
}

function readStore() {
  const file = grantsPath()
  if (!fs.existsSync(file)) return emptyStore()
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (parsed === null || typeof parsed !== 'object' || typeof parsed.sessions !== 'object' || parsed.sessions === null) return emptyStore()
    return { version: VERSION, sessions: parsed.sessions }
  } catch {
    return emptyStore()
  }
}

function writeStore(store) {
  const file = grantsPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = file + '.tmp-' + String(process.pid) + '-' + String(Date.now())
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: 0o600 })
  fs.renameSync(temporary, file)
}

function normalizeList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => String(item)).filter((item) => item.length > 0))]
}

function normalizeEntry(entry) {
  return {
    plugins: normalizeList(entry && entry.plugins),
    tools: normalizeList(entry && entry.tools),
    all: entry && entry.all === true,
  }
}

function pluginOf(toolName) {
  return String(toolName).split('-')[0]
}

export class ToolGrants {
  constructor() {
    this.store = readStore()
  }

  reload() {
    this.store = readStore()
  }

  list() {
    this.reload()
    return Object.entries(this.store.sessions)
      .map(([sessionId, entry]) => {
        const normalized = normalizeEntry(entry)
        return { sessionId, all: normalized.all, plugins: normalized.plugins, tools: normalized.tools }
      })
      .sort((left, right) => left.sessionId.localeCompare(right.sessionId))
  }

  grantsOf(sessionId) {
    this.reload()
    const entry = this.store.sessions[String(sessionId)]
    return entry === undefined ? null : normalizeEntry(entry)
  }

  allows(sessionId, toolName) {
    const entry = this.grantsOf(sessionId)
    if (entry === null) return false
    if (entry.all) return true
    if (entry.tools.includes(String(toolName))) return true
    return entry.plugins.includes(pluginOf(toolName))
  }

  grant(sessionId, options = {}) {
    const id = String(sessionId || '').trim()
    if (id === '') throw Object.assign(new Error('sessionId must be a non-empty string'), { status: 400 })
    const plugins = normalizeList(options.plugins)
    const tools = normalizeList(options.tools)
    const all = options.all === true || (plugins.length === 0 && tools.length === 0)
    this.reload()
    const current = normalizeEntry(this.store.sessions[id])
    const next = {
      all: all || current.all,
      plugins: [...new Set([...current.plugins, ...plugins])],
      tools: [...new Set([...current.tools, ...tools])],
    }
    this.store.sessions[id] = next
    writeStore(this.store)
    return { sessionId: id, ...normalizeEntry(next) }
  }

  revoke(sessionId, options = {}) {
    const id = String(sessionId || '').trim()
    if (id === '') throw Object.assign(new Error('sessionId must be a non-empty string'), { status: 400 })
    this.reload()
    const removeAll = options.all === true || (normalizeList(options.plugins).length === 0 && normalizeList(options.tools).length === 0)
    if (removeAll) {
      delete this.store.sessions[id]
      writeStore(this.store)
      return { sessionId: id, all: false, plugins: [], tools: [] }
    }
    const current = this.store.sessions[id]
    if (current === undefined) return { sessionId: id, all: false, plugins: [], tools: [] }
    const normalized = normalizeEntry(current)
    const plugins = normalizeList(options.plugins)
    const tools = normalizeList(options.tools)
    const next = {
      all: normalized.all,
      plugins: normalized.plugins.filter((plugin) => !plugins.includes(plugin)),
      tools: normalized.tools.filter((tool) => !tools.includes(tool)),
    }
    if (next.all === false && next.plugins.length === 0 && next.tools.length === 0) delete this.store.sessions[id]
    else this.store.sessions[id] = next
    writeStore(this.store)
    return { sessionId: id, ...normalizeEntry(next) }
  }
}
