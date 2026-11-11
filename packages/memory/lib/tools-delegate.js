import { textBlock } from './memory/format.js'

const DEFAULT_MAX_DELEGATES = 3

export const INVESTIGATOR_PROMPT = [
  '# 只读记忆侦查子 agent（一次性）',
  '',
  '你是 ID Agent 派出的**只读侦查员**：接到一条简短命令，自己慢慢查，最后交出**修改请求清单**，然后结束。',
  '',
  '## 你能用的手（只读，零副作用）',
  '- `memory-recall`（语义检索）/ `memory-entity-search`（实体名模糊查）/ `memory-read-entry`（按 id 看维护视图：模板 + 槽位 + 统计）/ `memory-read-entity`（实体档案）',
  '- `memory-candidates`（最凉 / 最热候选榜）/ `memory-entity-orphans`（零引用实体）',
  '- **你没有写权限**：不要尝试执行删除/合并/改指/升档——那是主 ID 的事。',
  '',
  '## 你要交的东西',
  '一条**修改请求清单**：每一项 = 一条你建议主 ID 执行的工具调用，**写成可直接照抄的一行 JSON**，形如：',
  '',
  '```',
  'memory-merge-entries {"ids":["mem_a","mem_b"],"content":"{$0} 喜欢 {$1}","refs":["ent_x","ent_y"],"type":"long","scope":"global"}',
  'memory-delete-entry {"ids":["mem_c","mem_d"]}',
  'memory-update-entry {"id":"mem_e","refs":[{"index":0,"new_id":"ent_z"}]}',
  'memory-bump-recency {"ids":["mem_f"]}',
  '```',
  '',
  '- 每行一个调用，行首是工具名，后面是参数 JSON；**id 必须真实存在**（来自你读到的数据）；',
  '- 每项下面可以跟一行 `# 理由：…`（简短，给主 ID 判断用）；',
  '- 拿不准的就别列——**宁可少提，不要瞎提**。没有可提的就回一行 `（无修改请求）`。',
  '',
  '## 边界',
  '- 只看你要查的范围；命令没说清的，按最保守的理解做，别扩大行动；',
  '- 不臆造 id、不猜测未读到的内容；',
  '- 交完清单就结束（不要追问、不要等回信）。',
].join('\n')

function delegateLimit() {
  const raw = Number(process.env.MEMORY_DELEGATE_MAX)
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_MAX_DELEGATES
  return Math.trunc(raw)
}

export function createDelegateTools(deps) {
  const running = new Set()
  let seq = 0

  const delegate = {
    name: 'memory-delegate',
    description: '派一个只读记忆侦查子 agent 去查记忆并产出修改请求清单（只读，无写权限）。立即返回，结果以 completion notice 投递。',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '给只读子 agent 的简短命令（要它查什么、产出哪类修改请求）' },
      },
      required: ['command'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          started: { type: 'boolean' },
          childName: { type: 'string' },
          provider: { type: 'string' },
          running: { type: 'integer' },
        },
      },
      render(_args, value) {
        return textBlock(
          '[memory-delegate] started child=' + value.childName + ' via=' + value.provider + ' running=' + String(value.running) + ' — the modification requests will arrive as a completion notice',
        )
      },
    },
    isConcurrencySafe() {
      return false
    },
    async execute(args, exec) {
      const command = String(args.command === undefined || args.command === null ? '' : args.command).trim()
      if (command === '') {
        throw Object.assign(new Error('empty-command (pass what the subagent should look into)'), { code: 'MEMORY_INVALID_ARGUMENT' })
      }
      const limit = delegateLimit()
      if (running.size >= limit) {
        throw Object.assign(
          new Error('too-many-subagents (' + String(running.size) + '/' + String(limit) + ' running — wait for one to report back)'),
          { code: 'MEMORY_BUSY' },
        )
      }
      const subagents = deps.subagents()
      if (subagents === undefined || subagents === null || typeof subagents.startActivation !== 'function') {
        throw Object.assign(new Error('subagent service is unavailable; load a subagent provider to delegate'), { code: 'MEMORY_SUBAGENT_UNAVAILABLE' })
      }
      if (exec === undefined || exec.agent === undefined) {
        throw Object.assign(new Error('memory-delegate requires a live agent caller'), { code: 'MEMORY_INVALID_ARGUMENT' })
      }

      const payload = [INVESTIGATOR_PROMPT, '', '[Task]', command].join('\n')
      const slot = 'investigator-' + String(++seq)
      running.add(slot)
      let activation
      try {
        activation = await subagents.startActivation({
          provider: deps.subagentProvider(),
          label: 'memory-investigator',
          prompt: [{ type: 'text', text: payload }],
          parent: exec.agent,
          delivery: 'parent',
        })
      } catch (error) {
        running.delete(slot)
        throw Object.assign(
          new Error('cannot start investigator: ' + (error instanceof Error ? error.message : String(error))),
          { code: 'MEMORY_SUBAGENT_FAILED' },
        )
      }

      Promise.resolve(activation.result)
        .catch(() => undefined)
        .finally(() => {
          running.delete(slot)
          refreshLastDelegate(deps, activation, slot)
        })

      return {
        started: true,
        childName: activation.name === undefined ? '' : String(activation.name),
        provider: deps.subagentProvider(),
        running: running.size,
      }
    },
  }

  return [delegate]
}

const lastDelegates = []

function refreshLastDelegate(deps, activation, slot) {
  lastDelegates.push({
    slot,
    childName: activation.name === undefined ? null : String(activation.name),
    at: new Date().toISOString(),
  })
  while (lastDelegates.length > 20) lastDelegates.shift()
  deps.lastDelegates = lastDelegates.slice()
}
