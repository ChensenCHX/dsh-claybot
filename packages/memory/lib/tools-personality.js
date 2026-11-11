import { textBlock } from './memory/format.js'
import { listScored } from './memory/stats.js'
import { readPersonality, readTaskPrompt, writePersonality } from './personality.js'

const PERSONA_SCAN_MAX = 1000
let refreshInFlight = false

const PERSONALITY_MARKER = '===PERSONALITY==='

function splitProposed(text) {
  const raw = String(text === undefined || text === null ? '' : text)
  const index = raw.indexOf(PERSONALITY_MARKER)
  if (index < 0) return { summary: '', body: raw.trim() }
  return {
    summary: raw.slice(0, index).trim(),
    body: raw.slice(index + PERSONALITY_MARKER.length).trim(),
  }
}

function buildPayload(currentMarkdown, rows, expanded) {
  const prompt = readTaskPrompt()
  const entries = rows.length === 0
    ? ['（无 persona 条目）']
    : rows.map((row) => '- ' + row.id + ' | ' + (expanded.get(row.id) === undefined ? '' : expanded.get(row.id)))
  return [
    prompt,
    '',
    '===== 当前 personality.md 开始 =====',
    currentMarkdown.trim() === '' ? '（空）' : currentMarkdown.trim(),
    '===== 当前 personality.md 结束 =====',
    '',
    '===== 待汇总的 persona 条目（' + String(rows.length) + ' 条）开始 =====',
    ...entries,
    '===== 待汇总的 persona 条目结束 =====',
  ].join('\n')
}

function extractText(output) {
  if (typeof output === 'string') return output
  if (!Array.isArray(output)) return ''
  return output
    .filter((block) => block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
}

export function createPersonalityTools(deps) {
  const writeTool = {
    name: 'memory-write-personality',
    description: '写入人格素材文件（整篇覆盖，不是增量追加）。通常由 ID agent 在审阅人格更新提议后调用。',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: '人格素材文件的完整内容（Markdown；覆盖旧内容）。不要包含 ===PERSONALITY=== 分隔行。',
        },
      },
      required: ['content'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chars: { type: 'integer' },
          path: { type: 'string', description: '写入的绝对路径' },
        },
      },
      render(_args, value) {
        return textBlock('[memory-write-personality] chars=' + String(value.chars) + ' path=' + value.path)
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args) {
      const text = String(args.content === undefined || args.content === null ? '' : args.content).trim()
      if (text === '') {
        throw Object.assign(new Error('empty-content (pass the full personality text)'), { code: 'MEMORY_INVALID_ARGUMENT' })
      }
      const path = writePersonality(text + '\n')
      return { chars: text.length, path }
    },
  }

  const refreshTool = {
    name: 'memory-refresh-personality',
    description: '刷新人格素材：拉起一次人格更新子 agent。子 agent 会把新人格文件的完整内容作为提议返回（不落盘），由调用者审阅后用 memory-write-personality 提交。立即返回，完成时以 completion notice 投递。',
    parameters: {
      type: 'object',
      properties: {},
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          started: { type: 'boolean' },
          personaCount: { type: 'integer' },
          childName: { type: 'string' },
          provider: { type: 'string' },
        },
      },
      render(_args, value) {
        return textBlock(
          '[memory-refresh-personality] started persona=' + String(value.personaCount) + ' via=' + value.provider + ' child=' + value.childName + ' — the proposed personality will arrive as a completion notice; review it, then commit with memory-write-personality',
        )
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(_args, exec) {
      if (refreshInFlight) {
        throw Object.assign(new Error('refresh-in-progress (a personality refresh is already running — wait for its completion notice)'), { code: 'MEMORY_BUSY' })
      }
      const subagents = deps.subagents()
      if (subagents === undefined || subagents === null || typeof subagents.startActivation !== 'function') {
        throw Object.assign(new Error('subagent service is unavailable; load a subagent provider to refresh personality'), { code: 'MEMORY_SUBAGENT_UNAVAILABLE' })
      }
      if (exec === undefined || exec.agent === undefined) {
        throw Object.assign(new Error('memory-refresh-personality requires a live agent caller'), { code: 'MEMORY_INVALID_ARGUMENT' })
      }
      const rows = await listScored(deps.db, { direction: 'hot', limit: PERSONA_SCAN_MAX, types: ['persona'] })
      const ids = rows.map((row) => row.id)
      const expanded = await deps.expand(ids)
      const payload = buildPayload(readPersonality(), rows, expanded)

      refreshInFlight = true
      let activation
      try {
        activation = await subagents.startActivation({
          provider: deps.subagentProvider(),
          label: 'personality-writer',
          prompt: [{ type: 'text', text: payload }],
          parent: exec.agent,
          delivery: 'parent',
        })
      } catch (error) {
        refreshInFlight = false
        throw Object.assign(new Error('cannot start personality writer: ' + (error instanceof Error ? error.message : String(error))), { code: 'MEMORY_SUBAGENT_FAILED' })
      }

      Promise.resolve(activation.result)
        .then((result) => {
          const text = extractText(result === undefined || result === null ? undefined : result.output)
          const proposed = splitProposed(text)
          deps.lastPersonalityRefresh = {
            at: new Date().toISOString(),
            childName: activation.name === undefined ? null : activation.name,
            stopReason: result === undefined || result === null || result.stopReason === undefined ? null : result.stopReason,
            chars: proposed.body.length,
            summary: proposed.summary,
          }
          return proposed
        })
        .catch((error) => {
          deps.lastPersonalityRefresh = {
            at: new Date().toISOString(),
            childName: activation.name === undefined ? null : activation.name,
            error: error instanceof Error ? error.message : String(error),
          }
        })
        .finally(() => {
          refreshInFlight = false
        })

      return {
        started: true,
        personaCount: rows.length,
        childName: activation.name === undefined ? '' : String(activation.name),
        provider: deps.subagentProvider(),
      }
    },
  }

  return [writeTool, refreshTool]
}
