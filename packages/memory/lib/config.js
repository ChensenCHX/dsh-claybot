import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

import { inferenceConfigPath, resolveStatePath, toStateRelative } from './paths.js'

const MODES = ['remote', 'llama']
const BACKENDS = ['auto', 'cpu', 'cuda', 'vulkan']

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validationError(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

function assertObject(value, name) {
  if (!isObject(value)) throw validationError(name + ' must be an object')
}

function assertAllowedKeys(value, allowed, name) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw validationError(name + ' has unknown field: ' + key)
  }
}

function asString(value, name, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== 'string') throw validationError(name + ' must be a string')
  return value
}

function asInteger(value, name, fallback, min, max) {
  if (value === undefined) return fallback
  if (!Number.isInteger(value) || value < min || value > max) throw validationError(name + ' must be an integer in [' + min + ', ' + max + ']')
  return value
}

function asEnum(value, name, allowed, fallback) {
  if (value === undefined) return fallback
  if (allowed.includes(value)) return value
  throw validationError(name + ' must be one of: ' + allowed.join(', '))
}

function asSecret(value, name, current, clearFlag) {
  if (clearFlag === true) return ''
  if (value === undefined || value === '') return current
  if (typeof value !== 'string') throw validationError(name + ' must be a string')
  return value
}

function asBoolean(value, name, fallback) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') throw validationError(name + ' must be a boolean')
  return value
}

function defaultConfig() {
  return {
    embedding: {
      mode: 'remote',
      dimensions: 1024,
      remote: { baseUrl: '', apiKey: '', model: '', path: '/v1/embeddings', batchSize: 16 },
      llama: { model: '', backend: 'auto', gpuLayers: 999, contextSize: 2048, pooling: 'mean', port: 54341, autoStart: false },
    },
    device: { prefer: 'auto' },
  }
}

function normalizeConfig(input, current) {
  const base = current || defaultConfig()
  const value = input === undefined ? {} : input
  assertObject(value, 'memory config')
  assertAllowedKeys(value, ['embedding', 'device'], 'memory config')

  const embeddingInput = value.embedding === undefined ? {} : value.embedding
  assertObject(embeddingInput, 'embedding')
  assertAllowedKeys(embeddingInput, ['mode', 'dimensions', 'remote', 'llama'], 'embedding')

  const remoteInput = embeddingInput.remote === undefined ? {} : embeddingInput.remote
  assertObject(remoteInput, 'embedding.remote')
  assertAllowedKeys(remoteInput, ['baseUrl', 'apiKey', 'model', 'path', 'batchSize', 'clearApiKey', 'hasApiKey'], 'embedding.remote')

  const llamaInput = embeddingInput.llama === undefined ? {} : embeddingInput.llama
  assertObject(llamaInput, 'embedding.llama')
  assertAllowedKeys(llamaInput, ['model', 'backend', 'gpuLayers', 'contextSize', 'pooling', 'port', 'autoStart'], 'embedding.llama')

  const embedding = {
    mode: asEnum(embeddingInput.mode, 'embedding.mode', MODES, base.embedding.mode),
    dimensions: asInteger(embeddingInput.dimensions, 'embedding.dimensions', base.embedding.dimensions, 1, 4096),
    remote: {
      baseUrl: asString(remoteInput.baseUrl, 'embedding.remote.baseUrl', base.embedding.remote.baseUrl),
      apiKey: asSecret(remoteInput.apiKey, 'embedding.remote.apiKey', base.embedding.remote.apiKey, remoteInput.clearApiKey),
      model: asString(remoteInput.model, 'embedding.remote.model', base.embedding.remote.model),
      path: asString(remoteInput.path, 'embedding.remote.path', base.embedding.remote.path),
      batchSize: asInteger(remoteInput.batchSize, 'embedding.remote.batchSize', base.embedding.remote.batchSize, 1, 512),
    },
    llama: {
      model: toStateRelative(asString(llamaInput.model, 'embedding.llama.model', base.embedding.llama.model)),
      backend: asEnum(llamaInput.backend, 'embedding.llama.backend', BACKENDS, base.embedding.llama.backend),
      gpuLayers: asInteger(llamaInput.gpuLayers, 'embedding.llama.gpuLayers', base.embedding.llama.gpuLayers, 0, 999),
      contextSize: asInteger(llamaInput.contextSize, 'embedding.llama.contextSize', base.embedding.llama.contextSize, 128, 1048576),
      pooling: asEnum(llamaInput.pooling, 'embedding.llama.pooling', ['mean', 'cls', 'last'], base.embedding.llama.pooling),
      port: asInteger(llamaInput.port, 'embedding.llama.port', base.embedding.llama.port, 1, 65535),
      autoStart: asBoolean(llamaInput.autoStart, 'embedding.llama.autoStart', base.embedding.llama.autoStart),
    },
  }

  const deviceInput = value.device === undefined ? {} : value.device
  assertObject(deviceInput, 'device')
  assertAllowedKeys(deviceInput, ['prefer'], 'device')

  return {
    embedding,
    device: { prefer: asEnum(deviceInput.prefer, 'device.prefer', BACKENDS, base.device.prefer) },
  }
}

function readInternal() {
  const file = inferenceConfigPath()
  if (!fs.existsSync(file)) return defaultConfig()
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    throw validationError('memory config is not valid JSON: ' + (error instanceof Error ? error.message : String(error)))
  }
  if (!isObject(parsed)) throw validationError('memory config must be an object')
  let candidate = parsed
  if (parsed.inference !== undefined && isObject(parsed.inference)) candidate = parsed.inference
  if (candidate.llm !== undefined) {
    candidate = { embedding: candidate.embedding, device: candidate.device }
  }
  return normalizeConfig(candidate, defaultConfig())
}

function writeInternal(config) {
  const file = inferenceConfigPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const temporary = file + '.tmp-' + process.pid + '-' + Date.now()
  fs.writeFileSync(temporary, JSON.stringify(config, null, 2), { mode: 0o600 })
  fs.renameSync(temporary, file)
}

function maskConfig(config) {
  const result = clone(config)
  result.embedding.remote.hasApiKey = Boolean(result.embedding.remote.apiKey)
  result.embedding.remote.apiKey = ''
  return result
}

function flatten(value, prefix = '', output = {}) {
  if (!isObject(value)) {
    output[prefix] = value
    return output
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? prefix + '.' + key : key, output)
  }
  return output
}

function diffConfig(current, next) {
  const before = flatten(current)
  const after = flatten(next)
  const changes = []
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of [...keys].sort()) {
    if (JSON.stringify(before[key]) === JSON.stringify(after[key])) continue
    const secret = key.endsWith('apiKey')
    changes.push({
      path: key,
      from: secret ? (before[key] ? '***' : '') : before[key] === undefined ? null : before[key],
      to: secret ? (after[key] ? '***' : '') : after[key] === undefined ? null : after[key],
    })
  }
  return changes
}

export class ConfigService {
  constructor(maintenance, db) {
    this.maintenance = maintenance
    this.db = db || maintenance.db
    this.devicesCache = null
  }

  databaseInfo() {
    const config = this.db?.config || {}
    return {
      backupDir: this.maintenance.settings().backupDir,
      postgresVersion: config.pgVersion || null,
      pgvectorVersion: config.pgvectorVersion || null,
    }
  }

  read() {
    const config = readInternal()
    const masked = maskConfig(config)
    masked.embedding.llama.model = toStateRelative(masked.embedding.llama.model)
    return {
      schemaVersion: 1,
      embedding: masked.embedding,
      device: masked.device,
      database: this.databaseInfo(),
    }
  }

  embeddingInternal() {
    const embedding = readInternal().embedding
    return {
      ...embedding,
      llama: {
        ...embedding.llama,
        model: resolveStatePath(embedding.llama.model),
      },
    }
  }

  save(input) {
    assertObject(input, 'config')
    const current = readInternal()
    const next = normalizeConfig(
      { embedding: input.embedding, device: input.device },
      current,
    )
    writeInternal(next)
    if (isObject(input.database) && typeof input.database.backupDir === 'string') {
      this.maintenance.saveBackupDir(input.database.backupDir)
    }
    return this.read()
  }

  exportSheet(options = {}) {
    const config = readInternal()
    const includeSecrets = options.includeSecrets === true
    const sheetConfig = maskConfig(config)
    sheetConfig.embedding.llama.model = toStateRelative(sheetConfig.embedding.llama.model)
    if (includeSecrets) {
      sheetConfig.embedding.remote.apiKey = config.embedding.remote.apiKey
      delete sheetConfig.embedding.remote.hasApiKey
    }
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      secretsRedacted: !includeSecrets,
      database: this.databaseInfo(),
      embedding: sheetConfig.embedding,
      device: sheetConfig.device,
    }
  }

  importSheet(sheet, options = {}) {
    assertObject(sheet, 'config sheet')
    assertAllowedKeys(sheet, ['schemaVersion', 'exportedAt', 'secretsRedacted', 'database', 'embedding', 'device'], 'config sheet')
    if (sheet.schemaVersion !== 1) throw validationError('unsupported config sheet schemaVersion')

    const current = readInternal()
    const next = normalizeConfig({ embedding: sheet.embedding, device: sheet.device }, current)
    const changes = diffConfig(current, next)
    const warnings = []
    let backupDir = null

    if (sheet.database !== undefined) {
      assertObject(sheet.database, 'database')
      assertAllowedKeys(sheet.database, ['backupDir', 'postgresVersion', 'pgvectorVersion'], 'database')
      if (sheet.database.backupDir !== undefined) {
        if (typeof sheet.database.backupDir !== 'string' || sheet.database.backupDir.trim().length === 0) {
          throw validationError('database.backupDir must be a non-empty string')
        }
        backupDir = sheet.database.backupDir
        const currentBackupDir = this.maintenance.settings().backupDir
        if (currentBackupDir !== backupDir) changes.push({ path: 'database.backupDir', from: currentBackupDir, to: backupDir })
      }
      const installed = this.databaseInfo()
      for (const key of ['postgresVersion', 'pgvectorVersion']) {
        const wanted = sheet.database[key]
        if (wanted === undefined) continue
        if (typeof wanted !== 'string') throw validationError('database.' + key + ' must be a string')
        if (installed[key] !== null && wanted !== installed[key]) {
          warnings.push('配置单要求 ' + key + '=' + wanted + '，当前安装 ' + installed[key] + '；版本更新请到数据库-组件页手动执行。')
        }
      }
    }

    const apply = options.apply === true
    if (apply) {
      writeInternal(next)
      if (backupDir !== null) this.maintenance.saveBackupDir(backupDir)
    }
    return { applied: apply, changes, warnings, config: apply ? this.read() : undefined }
  }

  devices() {
    if (this.devicesCache && Date.now() - this.devicesCache.at < 60 * 1000) return this.devicesCache.value
    const cpu = os.cpus()[0]
    const result = {
      platform: process.platform,
      arch: process.arch,
      cpu: { model: cpu?.model || '', cores: os.cpus().length },
      memoryBytes: os.totalmem(),
      gpus: [],
      backends: ['cpu'],
      recommended: 'cpu',
      cudaVersion: null,
      driverVersion: null,
    }
    if (process.platform === 'win32') {
      const smi = spawnSync('nvidia-smi', [], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
      if (smi.status === 0 && typeof smi.stdout === 'string') {
        const cuda = /CUDA (?:UMD )?Version:\s*([0-9.]+)/.exec(smi.stdout)
        const driver = /(?:KMD|Driver) Version:\s*([0-9.]+)/.exec(smi.stdout) || /NVIDIA-SMI\s+([0-9.]+)/.exec(smi.stdout)
        result.cudaVersion = cuda ? cuda[1] : null
        result.driverVersion = driver ? driver[1] : null
      }
      const nvidia = spawnSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      })
      if (nvidia.status === 0 && typeof nvidia.stdout === 'string') {
        for (const line of nvidia.stdout.split(/\r?\n/)) {
          const [name, memory] = line.split(',').map((part) => part.trim())
          if (name) result.gpus.push({ vendor: 'nvidia', name, memory: memory ? memory + ' MiB' : '' })
        }
        if (result.gpus.length > 0) {
          result.backends.push('cuda')
          result.recommended = 'cuda'
        }
      }
      if (result.gpus.length === 0) {
        const wmic = spawnSync('wmic', ['path', 'win32_VideoController', 'get', 'name'], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 5000,
        })
        if (wmic.status === 0 && typeof wmic.stdout === 'string') {
          const names = wmic.stdout
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0 && line.toLowerCase() !== 'name')
          for (const name of names) result.gpus.push({ vendor: '', name, memory: '' })
          if (result.gpus.length > 0) result.backends.push('vulkan')
        }
      }
    }
    if (result.gpus.length > 0 && !result.backends.includes('vulkan')) result.backends.push('vulkan')
    this.devicesCache = { at: Date.now(), value: result }
    return result
  }
}
