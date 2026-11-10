import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

import { curlExecutable, detectHttpProxy, extractArchive } from './installer.js'
import { readGgufMetadata } from './gguf.js'
import {
  depsDir,
  downloadsDir,
  embeddingStatePath,
  embeddingUsagePath,
  ensureDir,
  logsDir,
  modelsDir,
  readJson,
  resolveStatePath,
  toStateRelative,
  writeJson,
} from './paths.js'

const LLAMA_BUILD = 'b12110'
const LLAMA_BASE = 'https://github.com/ggml-org/llama.cpp/releases/download/' + LLAMA_BUILD + '/'

const LLAMA_ASSETS = {
  cpu: {
    backend: 'cpu',
    label: 'CPU',
    files: [
      {
        fileName: 'llama-' + LLAMA_BUILD + '-bin-win-cpu-x64.zip',
        url: LLAMA_BASE + 'llama-' + LLAMA_BUILD + '-bin-win-cpu-x64.zip',
        size: 24708445,
        sha256: '98901e327c252875accaf2d1bf364e10e868843b0b63468baad1aa945cdc5da2',
      },
    ],
  },
  vulkan: {
    backend: 'vulkan',
    label: 'Vulkan GPU',
    files: [
      {
        fileName: 'llama-' + LLAMA_BUILD + '-bin-win-vulkan-x64.zip',
        url: LLAMA_BASE + 'llama-' + LLAMA_BUILD + '-bin-win-vulkan-x64.zip',
        size: 37661146,
        sha256: '9732a5e48887ca54d0bfe4af4324dc85fd56cd8cda19b52df3542fa6ebe6874f',
      },
    ],
  },
  cuda: {
    backend: 'cuda',
    label: 'CUDA 12.4 GPU',
    version: '12.4',
    minCuda: '12.4',
    files: [
      {
        fileName: 'llama-' + LLAMA_BUILD + '-bin-win-cuda-12.4-x64.zip',
        url: LLAMA_BASE + 'llama-' + LLAMA_BUILD + '-bin-win-cuda-12.4-x64.zip',
        size: 287014657,
        sha256: '1ce755bc3a061889234048f88e33328e17971eaad73c4666cfeb26026b317fee',
      },
      {
        fileName: 'cudart-llama-bin-win-cuda-12.4-x64.zip',
        url: LLAMA_BASE + 'cudart-llama-bin-win-cuda-12.4-x64.zip',
        size: 391443627,
        sha256: '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6',
      },
    ],
  },
  cuda13: {
    backend: 'cuda13',
    label: 'CUDA 13.4 GPU',
    version: '13.4',
    minCuda: '13.4',
    files: [
      {
        fileName: 'llama-' + LLAMA_BUILD + '-bin-win-cuda-13.4-x64.zip',
        url: LLAMA_BASE + 'llama-' + LLAMA_BUILD + '-bin-win-cuda-13.4-x64.zip',
        size: 169175655,
        sha256: 'dc910a969190b5d42e189afd73117f6bbdd8dd8ed6586342c5e0b82cab62c673',
      },
      {
        fileName: 'cudart-llama-bin-win-cuda-13.4-x64.zip',
        url: LLAMA_BASE + 'cudart-llama-bin-win-cuda-13.4-x64.zip',
        size: 423535356,
        sha256: '738f8c251ac22b70c3ae6f83a10cf222725df0395246a2cf58f32bdb85fbe668',
      },
    ],
  },
}

const MODEL_CATALOG = [
  {
    id: 'nomic-embed-text-v1.5',
    name: 'Nomic Embed Text v1.5',
    params: '137M',
    paramsValue: 137,
    dimensions: 768,
    pooling: 'mean',
    contextSize: 2048,
    maxContext: 8192,
    repo: 'nomic-ai/nomic-embed-text-v1.5-GGUF',
    file: 'nomic-embed-text-v1.5.Q4_K_M.gguf',
    size: 84106624,
    sha256: 'd4e388894e09cf3816e8b0896d81d265b55e7a9fff9ab03fe8bf4ef5e11295ac',
    note: '最轻量，适合低配/先跑通；英文为主',
  },
  {
    id: 'bge-large-zh-v1.5',
    name: 'BGE Large ZH v1.5',
    params: '326M',
    paramsValue: 326,
    dimensions: 1024,
    pooling: 'cls',
    contextSize: 512,
    maxContext: 512,
    repo: 'CompendiumLabs/bge-large-zh-v1.5-gguf',
    file: 'bge-large-zh-v1.5-q4_k_m.gguf',
    size: 202115392,
    sha256: 'c1ba275e26fe84b5528782231391a75bcf76a30044a093ceec50c992f021dd23',
    note: '中文效果好，体积适中',
  },
  {
    id: 'qwen3-embedding-0.6b',
    name: 'Qwen3-Embedding 0.6B',
    params: '0.6B',
    paramsValue: 600,
    dimensions: 1024,
    pooling: 'last',
    contextSize: 2048,
    maxContext: 40960,
    repo: 'Qwen/Qwen3-Embedding-0.6B-GGUF',
    file: 'Qwen3-Embedding-0.6B-Q8_0.gguf',
    size: 639150592,
    sha256: '06507c7b42688469c4e7298b0a1e16deff06caf291cf0a5b278c308249c3e439',
    note: '多语言，Qwen3 官方，质量更强',
  },
  {
    id: 'qwen3-embedding-4b',
    name: 'Qwen3-Embedding 4B',
    params: '4B',
    paramsValue: 4000,
    dimensions: 2560,
    pooling: 'last',
    contextSize: 2048,
    maxContext: 40960,
    repo: 'Qwen/Qwen3-Embedding-4B-GGUF',
    file: 'Qwen3-Embedding-4B-Q4_K_M.gguf',
    size: 2496703776,
    sha256: '2b0cf8f17b4c723c27303015383c27ec4bf2d8314bb677d05e920dd70bb0f16b',
    note: '4B 大模型，约需 4–6GB VRAM/RAM；效果更强',
  },
  {
    id: 'qwen3-embedding-8b',
    name: 'Qwen3-Embedding 8B',
    params: '8B',
    paramsValue: 8000,
    dimensions: 4096,
    pooling: 'last',
    contextSize: 2048,
    maxContext: 40960,
    repo: 'Qwen/Qwen3-Embedding-8B-GGUF',
    file: 'Qwen3-Embedding-8B-Q4_K_M.gguf',
    size: 4676804928,
    sha256: '3fcd3febec8b3fd64435204db75bf0dd73b91e8d0661e0331acfe7e7c3120b85',
    note: '8B 大模型，需要较大显存/内存；效果最强，速度最慢',
  },
  {
    id: 'bge-m3',
    name: 'BGE-M3',
    params: '568M',
    paramsValue: 568,
    dimensions: 1024,
    pooling: 'cls',
    contextSize: 2048,
    maxContext: 8192,
    repo: 'CompendiumLabs/bge-m3-gguf',
    file: 'bge-m3-f16.gguf',
    size: 1157671200,
    sha256: '08e9d9f201d26c70c605e6ebbd30c06e686adf948c10faf27e1b333a945fb4f3',
    note: '多语言/长文本，效果好但文件较大',
  },
]

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = fs.createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function compareVersions(left, right) {
  const a = String(left || '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  const b = String(right || '').split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function findFile(root, name) {  const entries = fs.readdirSync(root, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return path.join(root, entry.name)
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const found = findFile(path.join(root, entry.name), name)
    if (found !== null) return found
  }
  return null
}

function readState() {
  return readJson(embeddingStatePath(), {})
}

function writeState(state) {
  writeJson(embeddingStatePath(), state)
}

function readUsage() {
  const value = readJson(embeddingUsagePath(), {})
  const events = Array.isArray(value.events) ? value.events.filter((entry) => entry && typeof entry === 'object' && typeof entry.at === 'string') : []
  return { events: pruneUsageEvents(events) }
}

function pruneUsageEvents(events) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  return events.filter((entry) => {
    const at = Date.parse(entry.at)
    return Number.isFinite(at) && at >= cutoff
  })
}

function writeUsage(usage) {
  try {
    writeJson(embeddingUsagePath(), usage)
  } catch {}
}

function fitEmbeddingVector(vector, dimensions) {
  const values = Array.isArray(vector) ? vector.map((value) => Number(value)) : []
  if (values.length === dimensions) return values
  if (values.length > dimensions) return values.slice(0, dimensions)
  return values.concat(new Array(dimensions - values.length).fill(0))
}

function runProcess(command, args, timeoutMs = 5000) {  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer = null
    let child
    try {
      child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      resolve({ status: null, stdout: '', stderr: error instanceof Error ? error.message : String(error) })
      return
    }
    const finish = (status) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      resolve({ status, stdout, stderr })
    }
    timer = setTimeout(() => {
      try { child.kill() } catch {}
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 1024 * 1024) stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 1024 * 1024) stderr += chunk.toString()
    })
    child.on('error', (error) => {
      stderr += error instanceof Error ? error.message : String(error)
      finish(null)
    })
    child.on('close', (code) => finish(code))
  })
}

function cleanPath(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true })
  } catch {}
}

async function downloadFile(source, destination, onProgress, label) {
  ensureDir(path.dirname(destination))
  if (fs.existsSync(destination) && fs.statSync(destination).size === source.size) {
    const digest = await sha256File(destination)
    if (digest === source.sha256) {
      onProgress?.({ phase: 'downloading', message: '已存在' + label + '，跳过下载', progress: 1 })
      return destination
    }
  }
  cleanPath(destination)
  const proxy = detectHttpProxy()
  const attempts = proxy === null ? [null] : [proxy, null]
  let lastError = null
  for (const attempt of attempts) {
    try {
      await new Promise((resolve, reject) => {
        const args = ['-L', '--fail', '--show-error', '--silent', '--retry', '1', '--retry-delay', '2', '--output', destination]
        if (attempt !== null) args.push('--proxy', attempt)
        args.push(source.url)
        const child = spawn(curlExecutable(), args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
        let stderr = ''
        child.stderr.on('data', (chunk) => {
          stderr += chunk
        })
        const startedAt = Date.now()
        const timer = setInterval(() => {
          let size = 0
          try {
            size = fs.statSync(destination).size
          } catch {}
          onProgress?.({
            phase: 'downloading',
            message: '正在下载' + label,
            progress: Math.min(0.99, size / source.size),
            received: size,
            total: source.size,
          })
          if (Date.now() - startedAt > 30 * 60 * 1000) child.kill()
        }, 1000)
        child.on('error', (error) => {
          clearInterval(timer)
          reject(error)
        })
        child.on('close', (code) => {
          clearInterval(timer)
          if (code !== 0) reject(new Error('curl exited with ' + String(code) + (stderr ? ': ' + stderr.trim() : '')))
          else resolve()
        })
      })
      const size = fs.statSync(destination).size
      if (size !== source.size) throw new Error(label + ' size mismatch: expected ' + source.size + ', got ' + size)
      const digest = await sha256File(destination)
      if (digest !== source.sha256) throw new Error(label + ' checksum mismatch')
      onProgress?.({ phase: 'downloading', message: '下载完成', progress: 1, received: size, total: source.size })
      return destination
    } catch (error) {
      lastError = error
      cleanPath(destination)
    }
  }
  throw lastError instanceof Error ? lastError : new Error('download failed: ' + label)
}

function modelDownloadUrl(model) {
  return 'https://huggingface.co/' + model.repo + '/resolve/main/' + model.file
}

export class EmbeddingService {
  constructor(configService) {
    this.configService = configService
    this.operation = null
    this.lastError = null
    this.server = null
    this.usage = readUsage()
    this.cpuSample = null
    this.lastEmbedding = null
  }

  get installed() {
    const state = readState()
    return Boolean(state.llama && state.llama.root && fs.existsSync(path.join(state.llama.root, state.llama.server || 'llama-server.exe')))
  }

  async healthy(port) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/health', { signal: AbortSignal.timeout(1500) })
      return response.ok
    } catch {
      return false
    }
  }

  async init() {
    const embedding = this.configService.embeddingInternal()
    if (embedding.mode !== 'llama' || embedding.llama.autoStart !== true) return
    if (!this.installed) return
    if (!embedding.llama.model || !fs.existsSync(embedding.llama.model)) return
    try {
      await this.start()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
    }
  }

  inspectGguf(filePath) {
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      throw Object.assign(new Error('GGUF path is required'), { status: 400 })
    }
    const absolute = resolveStatePath(filePath)
    try {
      if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
        throw Object.assign(new Error('GGUF file not found: ' + absolute), { status: 400 })
      }
      if (path.extname(absolute).toLowerCase() !== '.gguf') {
        throw Object.assign(new Error('not a .gguf file: ' + absolute), { status: 400 })
      }
      const metadata = readGgufMetadata(absolute)
      return { ...metadata, path: absolute }
    } catch (error) {
      if (error && error.status === 400) throw error
      throw Object.assign(new Error('failed to read GGUF metadata: ' + (error instanceof Error ? error.message : String(error))), { status: 400 })
    }
  }

  recordCall(entry) {
    if (!Array.isArray(this.usage.events)) this.usage.events = []
    this.usage.events.push(entry)
    this.usage.events = pruneUsageEvents(this.usage.events)
    writeUsage(this.usage)
  }

  usageSnapshot() {
    const events = pruneUsageEvents(Array.isArray(this.usage.events) ? this.usage.events : [])
    const hour = 60 * 60 * 1000
    const currentHour = Math.floor(Date.now() / hour) * hour
    const buckets = []
    for (let offset = 23; offset >= 0; offset -= 1) {
      const start = currentHour - offset * hour
      const end = start + hour
      const items = events.filter((entry) => {
        const at = Date.parse(entry.at)
        return at >= start && at < end
      })
      buckets.push({
        start: new Date(start).toISOString(),
        total: items.length,
        success: items.filter((entry) => entry.ok).length,
        failure: items.filter((entry) => !entry.ok).length,
      })
    }
    return {
      total: events.length,
      success: events.filter((entry) => entry.ok).length,
      failure: events.filter((entry) => !entry.ok).length,
      recent: events.slice(-10).reverse().map((entry) => ({ ...entry })),
      buckets,
      windowHours: 24,
    }
  }

  remoteEndpoint(embedding) {
    const baseUrl = String(embedding.remote.baseUrl || '').trim().replace(/\/+$/, '')
    if (baseUrl === '') return ''
    const suffix = String(embedding.remote.path || '/v1/embeddings')
    return baseUrl + (suffix.startsWith('/') ? suffix : '/' + suffix)
  }

  async remoteReachable(baseUrl) {
    const base = String(baseUrl || '').trim()
    if (base === '') return false
    try {
      await fetch(base, { method: 'GET', signal: AbortSignal.timeout(3000) })
      return true
    } catch {
      return false
    }
  }

  sampleCpu() {
    const cpus = os.cpus()
    let idle = 0
    let total = 0
    for (const cpu of cpus) {
      for (const value of Object.values(cpu.times)) total += value
      idle += cpu.times.idle
    }
    const current = { idle, total, at: Date.now() }
    let percent = null
    if (this.cpuSample !== null) {
      const totalDiff = current.total - this.cpuSample.total
      const idleDiff = current.idle - this.cpuSample.idle
      if (totalDiff > 0) percent = Math.max(0, Math.min(100, 100 * (1 - idleDiff / totalDiff)))
    }
    this.cpuSample = current
    return percent
  }

  async llamaResources() {
    const state = readState()
    const pid = this.server !== null ? this.server.pid : state.pid || null
    const smiPromise = runProcess('nvidia-smi', ['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'], 5000)
    const appsPromise = pid !== null
      ? runProcess('nvidia-smi', ['--query-compute-apps=pid,used_memory', '--format=csv,noheader,nounits'], 5000)
      : Promise.resolve(null)
    const vramPromise = pid !== null && process.platform === 'win32'
      ? runProcess('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          "$p = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUProcessMemory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'pid_" + String(pid) + "_*' }; if ($p) { ($p | Measure-Object -Property DedicatedUsage -Sum).Sum }",
        ], 5000)
      : Promise.resolve(null)
    const ramPromise = pid !== null && process.platform === 'win32'
      ? runProcess('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '$p = Get-Process -Id ' + String(pid) + ' -ErrorAction SilentlyContinue; if ($p) { [int64]$p.WorkingSet64 }',
        ], 5000)
      : Promise.resolve(null)
    const [smi, apps, vram, ram] = await Promise.all([smiPromise, appsPromise, vramPromise, ramPromise])

    let gpuUsed = null
    let gpuTotal = null
    let gpuUtil = null
    let llamaGpu = null
    if (smi !== null && smi.status === 0 && typeof smi.stdout === 'string') {
      const first = smi.stdout.split(/\r?\n/).find((line) => line.trim() !== '')
      if (first) {
        const [util, used, total] = first.split(',').map((part) => Number.parseInt(part.trim(), 10))
        gpuUtil = Number.isFinite(util) ? util : null
        gpuUsed = Number.isFinite(used) ? used : null
        gpuTotal = Number.isFinite(total) ? total : null
      }
    }
    if (apps !== null && apps.status === 0 && typeof apps.stdout === 'string') {
      for (const line of apps.stdout.split(/\r?\n/)) {
        const [appPid, memory] = line.split(',').map((part) => part.trim())
        if (Number.parseInt(appPid, 10) === pid) {
          const value = Number.parseInt(memory, 10)
          llamaGpu = Number.isFinite(value) ? value : null
          break
        }
      }
    }
    if (llamaGpu === null && vram !== null && vram.status === 0 && typeof vram.stdout === 'string') {
      const bytes = Number.parseInt(vram.stdout.trim(), 10)
      if (Number.isFinite(bytes) && bytes > 0) llamaGpu = Math.round(bytes / (1024 * 1024))
    }
    let llamaRam = null
    if (ram !== null && ram.status === 0 && typeof ram.stdout === 'string') {
      const value = Number.parseInt(ram.stdout.trim(), 10)
      llamaRam = Number.isFinite(value) ? value : null
    }
    return {
      cpu: { usagePercent: this.sampleCpu(), cores: os.cpus().length },
      gpu: { utilPercent: gpuUtil, usedMiB: gpuUsed, totalMiB: gpuTotal, llamaMiB: llamaGpu },
      ram: {
        llamaBytes: llamaRam,
        usedBytes: os.totalmem() - os.freemem(),
        systemTotalBytes: os.totalmem(),
        systemFreeBytes: os.freemem(),
      },
    }
  }

  async embed(inputs) {
    const list = Array.isArray(inputs) ? inputs.map((item) => String(item)) : [String(inputs)]
    if (list.length === 0) throw Object.assign(new Error('embedding input is empty'), { status: 400 })
    const embedding = this.configService.embeddingInternal()
    const startedAt = Date.now()
    let endpoint = ''
    try {
      let body
      const headers = { 'content-type': 'application/json' }
      if (embedding.mode === 'remote') {
        const baseUrl = String(embedding.remote.baseUrl || '').trim()
        if (baseUrl === '') throw Object.assign(new Error('remote embedding baseUrl is empty'), { status: 400 })
        endpoint = this.remoteEndpoint(embedding)
        if (embedding.remote.apiKey) headers.authorization = 'Bearer ' + embedding.remote.apiKey
        body = { model: embedding.remote.model || 'default', input: list }
      } else {
        const port = embedding.llama.port
        endpoint = 'http://127.0.0.1:' + port + '/v1/embeddings'
        if (!(await this.healthy(port))) throw Object.assign(new Error('llama.cpp embedding endpoint is not available'), { status: 503 })
        body = { model: 'local', input: list }
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
      const text = await response.text()
      if (!response.ok) throw new Error('embedding endpoint returned HTTP ' + response.status + ': ' + text.slice(0, 300))
      let payload
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error('embedding endpoint did not return JSON')
      }
      const data = Array.isArray(payload.data) ? payload.data : []
      const vectors = data.map((item) => Array.isArray(item.embedding) ? item.embedding : null)
      if (vectors.length !== list.length || vectors.some((vector) => vector === null)) {
        throw new Error('embedding endpoint returned an unexpected response shape')
      }
      const nativeDimensions = vectors[0].length
      const targetDimensions = Number(embedding.dimensions) || nativeDimensions
      const fitted = vectors.map((vector) => fitEmbeddingVector(vector, targetDimensions))
      this.lastEmbedding = {
        nativeDimensions,
        dimensions: targetDimensions,
        adapted: nativeDimensions !== targetDimensions,
        at: new Date().toISOString(),
      }
      const entry = {
        at: new Date().toISOString(),
        mode: embedding.mode,
        ok: true,
        endpoint,
        inputs: list.length,
        nativeDimensions,
        dimensions: targetDimensions,
        adapted: nativeDimensions !== targetDimensions,
        durationMs: Date.now() - startedAt,
      }
      this.recordCall(entry)
      return fitted
    } catch (error) {
      this.recordCall({
        at: new Date().toISOString(),
        mode: embedding.mode,
        ok: false,
        endpoint,
        inputs: list.length,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  async probe() {
    const vectors = await this.embed(['claybot embedding probe'])
    return {
      ok: true,
      dimensions: vectors[0].length,
      nativeDimensions: this.lastEmbedding ? this.lastEmbedding.nativeDimensions : vectors[0].length,
      adapted: this.lastEmbedding ? this.lastEmbedding.adapted : false,
      usage: this.usageSnapshot(),
    }
  }

  async monitor() {
    const config = this.configService.read()
    const embedding = config.embedding
    const internal = this.configService.embeddingInternal()
    const usage = this.usageSnapshot()
    const checkedAt = new Date().toISOString()
    const operation = this.operation
    if (embedding.mode === 'remote') {
      const baseUrl = internal.remote.baseUrl || ''
      return {
        mode: 'remote',
        endpoint: this.remoteEndpoint(internal),
        available: await this.remoteReachable(baseUrl),
        checkedAt,
        operation,
        usage,
        lastEmbedding: this.lastEmbedding,
        remote: {
          baseUrl,
          model: embedding.remote.model || '',
          path: embedding.remote.path || '/v1/embeddings',
        },
      }
    }
    const port = embedding.llama.port
    const running = (this.server !== null && this.server.exitCode === null) || await this.healthy(port)
    const state = readState()
    return {
      mode: 'llama',
      endpoint: 'http://127.0.0.1:' + port + '/v1/embeddings',
      available: running,
      running,
      checkedAt,
      operation,
      usage,
      lastEmbedding: this.lastEmbedding,
      llama: {
        build: state.llama ? state.llama.build : null,
        backend: state.llama ? state.llama.backend : null,
        model: embedding.llama.model || '',
        pid: this.server !== null ? this.server.pid : state.pid || null,
      },
      resources: await this.llamaResources(),
    }
  }

  async status() {
    const config = this.configService.read()
    const embedding = config.embedding
    const internal = this.configService.embeddingInternal()
    const device = config.device
    const deviceInfo = this.configService.devices()
    const cudaVersion = deviceInfo.cudaVersion || null
    const state = readState()
    const llamaState = state.llama || null
    const binaryPath = llamaState ? path.join(llamaState.root, llamaState.server || 'llama-server.exe') : null
    const modelPath = internal.llama.model || null
    let running = false
    if (embedding.mode === 'llama') {
      if (this.server !== null && this.server.exitCode === null) running = true
      else running = await this.healthy(embedding.llama.port)
    }
    const assets = Object.values(LLAMA_ASSETS).map((asset) => ({
      backend: asset.backend,
      label: asset.label,
      version: asset.version || null,
      minCuda: asset.minCuda || null,
      size: asset.files.reduce((sum, file) => sum + file.size, 0),
      installable: asset.minCuda === undefined ? true : Boolean(cudaVersion) && compareVersions(cudaVersion, asset.minCuda) >= 0,
      recommended: false,
      installed: Boolean(llamaState && llamaState.backend === asset.backend),
    }))
    let recommendedBackend = 'cpu'
    if (deviceInfo.recommended === 'cuda') {
      const candidates = assets
        .filter((asset) => (asset.backend === 'cuda' || asset.backend === 'cuda13') && asset.installable)
        .sort((left, right) => compareVersions(right.version, left.version))
      recommendedBackend = candidates[0] ? candidates[0].backend : assets.some((asset) => asset.backend === 'vulkan') ? 'vulkan' : 'cpu'
    } else if (deviceInfo.recommended === 'vulkan') {
      recommendedBackend = 'vulkan'
    }
    const recommendedAsset = assets.find((asset) => asset.backend === recommendedBackend)
    if (recommendedAsset) recommendedAsset.recommended = true
    let modelDimensions = null
    if (embedding.mode === 'llama' && modelPath && fs.existsSync(modelPath)) {
      try {
        const metadata = this.inspectGguf(modelPath)
        if (metadata && Number(metadata.dimensions) > 0) modelDimensions = Number(metadata.dimensions)
      } catch {}
    }
    return {
      installed: Boolean(binaryPath && fs.existsSync(binaryPath)),
      running,
      operation: this.operation,
      lastError: this.lastError,
      llama: llamaState
        ? { build: llamaState.build, backend: llamaState.backend, root: llamaState.root, server: llamaState.server, binaryPath, installedAt: llamaState.installedAt }
        : null,
      model: modelPath
        ? { path: modelPath, relativePath: toStateRelative(modelPath), exists: fs.existsSync(modelPath), size: fs.existsSync(modelPath) ? fs.statSync(modelPath).size : 0, dimensions: modelDimensions }
        : null,
      modelDimensions,
      embedding,
      device,
      deviceCudaVersion: cudaVersion,
      deviceRecommended: deviceInfo.recommended,
      assets,
      models: MODEL_CATALOG
        .slice()
        .sort((left, right) => left.paramsValue - right.paramsValue)
        .map((model) => {
        const file = path.join(modelsDir(), model.id, model.file)
        return {
          ...model,
          downloadUrl: modelDownloadUrl(model),
          path: file,
          relativePath: toStateRelative(file),
          downloaded: fs.existsSync(file),
          downloadedSize: fs.existsSync(file) ? fs.statSync(file).size : 0,
        }
      }),
    }
  }

  async install(backend = 'vulkan') {
    if (this.operation !== null) throw new Error('another embedding operation is running')
    const asset = LLAMA_ASSETS[backend]
    if (asset === undefined) throw new Error('unsupported backend: ' + String(backend))
    this.lastError = null
    if (asset.minCuda) {
      const cudaVersion = this.configService.devices().cudaVersion
      if (!cudaVersion || compareVersions(cudaVersion, asset.minCuda) < 0) {
        const error = Object.assign(new Error('CUDA ' + asset.minCuda + ' 需要更新显卡驱动（当前 CUDA ' + (cudaVersion || '未知') + '）'), { status: 400 })
        this.lastError = error.message
        throw error
      }
    }
    this.operation = { phase: 'downloading', message: '准备安装 llama.cpp', progress: 0, backend, startedAt: new Date().toISOString() }
    try {
      const total = asset.files.reduce((sum, file) => sum + file.size, 0)
      let completed = 0
      const archives = []
      for (const file of asset.files) {
        const archive = await downloadFile(file, path.join(downloadsDir(), file.fileName), (update) => {
          const received = completed + (update.received || 0)
          this.operation = {
            ...this.operation,
            ...update,
            progress: Math.min(0.99, received / total),
            received,
            total,
          }
        }, ' llama.cpp ' + asset.label + ' ')
        archives.push(archive)
        completed += file.size
      }
      this.operation = { phase: 'extracting', message: '正在解压 llama.cpp', progress: 0, backend, startedAt: this.operation.startedAt }
      const root = path.join(depsDir(), 'llama.cpp', LLAMA_BUILD, backend)
      cleanPath(root)
      ensureDir(root)
      for (const archive of archives) await extractArchive(archive, root)
      const server = findFile(root, 'llama-server.exe')
      if (server === null) throw new Error('llama-server.exe not found in ' + root)
      const state = readState()
      state.llama = {
        build: LLAMA_BUILD,
        backend,
        root,
        server: path.relative(root, server).replace(/\\/g, '/'),
        installedAt: new Date().toISOString(),
      }
      writeState(state)
      this.operation = null
      return this.status()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.operation = null
      throw error
    }
  }

  async downloadModel(modelId) {
    if (this.operation !== null) throw new Error('another embedding operation is running')
    const model = MODEL_CATALOG.find((item) => item.id === modelId)
    if (model === undefined) throw new Error('unknown model: ' + String(modelId))
    this.lastError = null
    this.operation = { phase: 'downloading', message: '准备下载 ' + model.name, progress: 0, modelId, startedAt: new Date().toISOString() }
    try {
      const destination = path.join(modelsDir(), model.id, model.file)
      await downloadFile({ ...model, url: modelDownloadUrl(model) }, destination, (update) => {
        this.operation = { ...this.operation, ...update }
      }, ' ' + model.name + ' ')
      this.operation = null
      return { model, path: destination, size: fs.statSync(destination).size }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.operation = null
      throw error
    }
  }

  browse(target) {
    let dir = typeof target === 'string' && target.trim().length > 0 ? resolveStatePath(target.trim()) : os.homedir()
    if (fs.existsSync(dir) && fs.statSync(dir).isFile()) dir = path.dirname(dir)
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) dir = os.homedir()
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const dirs = []
    const files = []
    for (const entry of entries) {
      if (entry.isDirectory()) dirs.push({ name: entry.name, path: path.join(dir, entry.name) })
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.gguf')) {
        const file = path.join(dir, entry.name)
        files.push({ name: entry.name, path: file, size: fs.statSync(file).size })
      }
    }
    dirs.sort((a, b) => a.name.localeCompare(b.name))
    files.sort((a, b) => a.name.localeCompare(b.name))
    const parent = path.dirname(dir)
    return { path: dir, parent: parent === dir ? null : parent, dirs, files }
  }

  async start() {
    if (this.operation !== null) throw new Error('another embedding operation is running')
    const embedding = this.configService.embeddingInternal()
    if (embedding.mode !== 'llama') throw new Error('embedding mode is not llama.cpp')
    const state = readState()
    if (!state.llama) throw new Error('llama.cpp runtime is not installed')
    const server = path.join(state.llama.root, state.llama.server || 'llama-server.exe')
    if (!fs.existsSync(server)) throw new Error('llama-server.exe not found')
    const model = embedding.llama.model
    if (typeof model !== 'string' || model.length === 0 || !fs.existsSync(model)) throw new Error('GGUF model path is not set or does not exist')
    if (await this.healthy(embedding.llama.port)) return this.status()
    this.lastError = null
    this.operation = { phase: 'starting', message: '正在启动 llama.cpp embedding 服务', progress: null, startedAt: new Date().toISOString() }
    try {
      ensureDir(logsDir())
      const log = path.join(logsDir(), 'embedding.log')
      const logFd = fs.openSync(log, 'a')
      const gpuLayers = state.llama.backend === 'cpu' ? 0 : embedding.llama.gpuLayers
      const args = [
        '-m',
        model,
        '--host',
        '127.0.0.1',
        '--port',
        String(embedding.llama.port),
        '--embeddings',
        '--pooling',
        embedding.llama.pooling || 'mean',
        '-c',
        String(embedding.llama.contextSize || 2048),
        '-ngl',
        String(gpuLayers),
      ]
      const child = spawn(server, args, { cwd: state.llama.root, windowsHide: true, stdio: ['ignore', logFd, logFd] })
      fs.closeSync(logFd)
      child.on('error', () => {})
      let ready = false
      for (let index = 0; index < 120; index += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        if (child.exitCode !== null) break
        if (await this.healthy(embedding.llama.port)) {
          ready = true
          break
        }
      }
      if (!ready) {
        try { child.kill() } catch {}
        throw new Error('llama.cpp did not become healthy; see ' + log)
      }
      this.server = child
      state.pid = child.pid
      writeState(state)
      this.operation = null
      return this.status()
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      this.operation = null
      throw error
    }
  }

  async stop() {
    const state = readState()
    if (this.server !== null) {
      try { this.server.kill() } catch {}
      this.server = null
    }
    if (state.pid) {
      spawnSync('taskkill', ['/PID', String(state.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      delete state.pid
      writeState(state)
    }
    return this.status()
  }

  async restart() {
    await this.stop()
    return this.start()
  }

  dispose() {
    if (this.server !== null) {
      try { this.server.kill() } catch {}
      this.server = null
    }
  }
}
