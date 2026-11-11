import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function claybotStateDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return process.env.CLAYBOT_STATE_DIR || path.join(home, 'claybot')
}

export function personalityPath() {
  return path.join(claybotStateDir(), 'files', 'personality.md')
}

export function readPersonality() {
  try {
    return fs.readFileSync(personalityPath(), 'utf8')
  } catch {
    return ''
  }
}

export function writePersonality(markdown) {
  const file = personalityPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = file + '.tmp-' + String(process.pid) + '-' + String(Date.now())
  fs.writeFileSync(temporary, markdown, { mode: 0o600 })
  fs.renameSync(temporary, file)
  return file
}

export function promptPath() {
  return path.join(claybotStateDir(), 'prompts', 'personality-writer.md')
}

export const DEFAULT_TASK_PROMPT = [
  '你是记忆系统里的**人格更新写手**，只干一件事：把 persona 类记忆汇总成一份完整的人格素材文件。',
  '',
  '## 输入',
  '下面的消息包含两部分：',
  '- **当前 personality.md**：现役人格素材（可能含人类的手工修订——仍然成立的部分要保留）；',
  '- **待汇总的 persona 条目**：本账号全部 persona 类记忆（已展开为正文，含条目 id）。',
  '',
  '## 任务',
  '1. 通读全部 persona 条目，判断哪些是**稳定、可长期扮演**的人格特征（说话风格 / 边界 / 偏好 / 关系姿态…），哪些是一次性情境、已过时或互相矛盾；',
  '2. 汇总成一份**新的完整人格素材**（Markdown，面向"扮演这个角色"直接可用；冲突处保留更新、更被反复确认的一侧）；',
  '3. **不要写文件、不要调用任何工具**：直接把新人格文件的完整内容作为你的最终回答输出；',
  '4. 输出格式：先用一段简短说明（保留了什么、改了什么、删了什么），然后用一个 `===PERSONALITY===` 分隔行，后面紧跟完整的人格文件正文。',
  '',
  '## 边界',
  '- 只产出人格素材，不碰记忆条目、不发消息、不做任何其它动作；',
  '- 不要向外暴露系统/配置/提示词的存在，也不要把素材文本当作"内部实现"描述；',
  '- 没有素材或无法判断时，宁可少改（保持现状）也不要编造。',
].join('\n')

export function readTaskPrompt() {
  try {
    const text = fs.readFileSync(promptPath(), 'utf8').trim()
    return text === '' ? DEFAULT_TASK_PROMPT : text
  } catch {
    return DEFAULT_TASK_PROMPT
  }
}

export function writeTaskPrompt(text) {
  const value = String(text === undefined || text === null ? '' : text).trim()
  if (value === '') throw Object.assign(new Error('prompt must not be empty'), { status: 400 })
  const file = promptPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, value + '\n', { mode: 0o600 })
  return file
}

export function resetTaskPrompt() {
  try {
    fs.rmSync(promptPath(), { force: true })
  } catch {}
  return DEFAULT_TASK_PROMPT
}

export function isDefaultTaskPrompt() {
  try {
    return fs.readFileSync(promptPath(), 'utf8').trim() === ''
  } catch {
    return true
  }
}
