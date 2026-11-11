import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getEntity, searchEntities } from './memory/entities.js'
import { countReferrers, createEntry, repointRefs } from './memory/entries.js'
import { MemoryRenderer } from './memory-render.js'
import { createReadTools } from './tools-read.js'
import { createMaintainBatch2Tools, createMaintainTools } from './tools-maintain.js'
import { createWriteTools } from './tools-write.js'
import { createUpdateTools } from './tools-update.js'
import { createPersonalityTools } from './tools-personality.js'
import { createDelegateTools } from './tools-delegate.js'

const GRANTS_FILE = 'tool-grants.json'

function grantsPath() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const stateDir = process.env.CLAYBOT_STATE_DIR || path.join(home, 'claybot')
  return path.join(stateDir, GRANTS_FILE)
}

function readSessionEntry(sessionId, toolName) {
  const file = grantsPath()
  if (!fs.existsSync(file)) return false
  let sessions
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    sessions = parsed && typeof parsed === 'object' ? parsed.sessions : null
  } catch {
    return false
  }
  if (sessions === null || typeof sessions !== 'object') return false
  const entry = sessions[String(sessionId)]
  if (entry === null || entry === undefined || typeof entry !== 'object') return false
  if (entry.all === true) return true
  const tools = Array.isArray(entry.tools) ? entry.tools.map((item) => String(item)) : []
  if (tools.includes(String(toolName))) return true
  const plugins = Array.isArray(entry.plugins) ? entry.plugins.map((item) => String(item)) : []
  return plugins.includes(String(toolName).split('-')[0])
}

export const MEMORY_READ_ONLY_TOOLS = [
  'memory-recall',
  'memory-entity-search',
  'memory-read-entry',
  'memory-read-entity',
  'memory-candidates',
  'memory-entity-orphans',
]

export const MEMORY_TOOL_NAMES = [
  'memory-recall',
  'memory-entity-search',
  'memory-read-entry',
  'memory-read-entity',
  'memory-candidates',
  'memory-entity-orphans',
  'memory-create-entity',
  'memory-delete-entity',
  'memory-merge-entities',
  'memory-update-refs',
  'memory-bump-recency',
  'memory-write-short',
  'memory-delete-entry',
  'memory-merge-entries',
  'memory-update-entry',
  'memory-write-personality',
  'memory-refresh-personality',
  'memory-delegate',
]

export function createMemoryTools(db, config, embedding, ctx) {
  const renderer = new MemoryRenderer(db)
  const deps = {
    db,
    dimensions: () => Number(config.read().embedding.dimensions),
    embedText: async (text) => {
      const vectors = await embedding.embed([text])
      return vectors[0]
    },
    expand: (ids) => renderer.expand(ids),
    searchEntities: (query, limit) => searchEntities(db, { query, limit }),
    getEntity: (id) => getEntity(db, id),
    countReferrers: (id, kind) => countReferrers(db, id, kind),
    repointRefs: (fromId, toId) => repointRefs(db, fromId, toId),
    createEntry: (client, input) => createEntry(client, input),
    subagents: () => {
      if (ctx === undefined || ctx === null || typeof ctx.get !== 'function') return undefined
      try {
        return ctx.get('subagents')
      } catch {
        return undefined
      }
    },
    subagentProvider: () => (process.env.CLAYBOT_SUBAGENT_PROVIDER || 'spawn'),
    lastPersonalityRefresh: null,
  }
  return [
    ...createReadTools(deps),
    ...createMaintainTools(deps),
    ...createMaintainBatch2Tools(deps),
    ...createWriteTools(deps),
    ...createUpdateTools(deps),
    ...createPersonalityTools(deps),
    ...createDelegateTools(deps),
  ]
}

export function registerMemoryTools(ctx, tools) {
  const disposers = []
  const readOnly = new Set(MEMORY_READ_ONLY_TOOLS)
  for (const definition of tools) {
    const name = definition.name
    disposers.push(ctx.tools.register(definition, {
      when: ({ agent }) => {
        if (agent === undefined || agent.id === undefined) return false
        const sessionId = String(agent.id)
        if (sessionId === '') return false
        try {
          if (readSessionEntry(sessionId, name)) return true
        } catch {
          return false
        }
        if (!readOnly.has(name)) return false
        try {
          const subagents = typeof ctx.get === 'function' ? ctx.get('subagents') : undefined
          if (subagents === undefined || subagents === null || typeof subagents.rootOf !== 'function') return false
          const root = subagents.rootOf(agent)
          if (root === undefined || root === null || root.id === undefined) return false
          const rootId = String(root.id)
          if (rootId === sessionId) return false
          return readSessionEntry(rootId, name)
        } catch {
          return false
        }
      },
    }))
  }
  return disposers
}
