import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

import { CATALOG, curlExecutable, detectHttpProxy } from './installer.js'
import { passwordForRole, userForRole } from './roles.js'
import { backupsDir, ensureDir, readSettings, writeSettings } from './paths.js'

function compareVersions(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return 0
  const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

async function curlGetText(url, headers = {}) {
  const proxy = detectHttpProxy()
  const attempts = proxy === null ? [null] : [proxy, null]
  let lastError = null
  for (const attempt of attempts) {
    try {
      return await new Promise((resolve, reject) => {
        const args = ['-L', '--fail', '--silent', '--show-error', '--max-time', '20']
        if (attempt !== null) args.push('--proxy', attempt)
        for (const [key, value] of Object.entries(headers)) args.push('-H', key + ': ' + value)
        args.push(url)
        const child = spawn(curlExecutable(), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => {
          stdout += chunk
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk
        })
        const timer = setTimeout(() => {
          child.kill()
          reject(new Error('request timed out: ' + url))
        }, 25000)
        child.on('error', (error) => {
          clearTimeout(timer)
          reject(error)
        })
        child.on('close', (code) => {
          clearTimeout(timer)
          if (code !== 0) {
            reject(new Error('curl exited with ' + String(code) + (stderr ? ': ' + stderr.trim() : '')))
            return
          }
          resolve(stdout)
        })
      })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('request failed: ' + url)
}

async function latestPgvector() {
  const text = await curlGetText('https://api.github.com/repos/pgvector/pgvector/tags?per_page=1', {
    'User-Agent': 'claybot-memory-maintenance',
    Accept: 'application/vnd.github+json',
  })
  const tags = JSON.parse(text)
  const tag = Array.isArray(tags) && tags[0] ? String(tags[0].name || '') : ''
  if (!tag) throw new Error('pgvector latest tag not found')
  return tag.replace(/^v/, '')
}

async function latestPostgres(currentVersion) {
  const currentMajor = String(currentVersion || CATALOG.pgVersion).split('.')[0]
  const text = await curlGetText('https://www.postgresql.org/versions.json', {
    'User-Agent': 'claybot-memory-maintenance',
    Accept: 'application/json',
  })
  const versions = JSON.parse(text)
  if (!Array.isArray(versions)) throw new Error('invalid PostgreSQL versions response')
  const entry = versions.find((item) => String(item.major) === currentMajor) || versions.filter((item) => item.supported).at(-1)
  if (!entry) throw new Error('PostgreSQL version entry not found')
  return String(entry.major) + '.' + String(entry.latestMinor)
}

function timestampForFile() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '-' +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  )
}

function ensureWritableDirectory(dir) {
  ensureDir(dir)
  const probe = path.join(dir, '.claybot-write-test-' + process.pid + '-' + Date.now())
  fs.writeFileSync(probe, 'ok')
  fs.rmSync(probe, { force: true })
}

function withTimeout(promise, timeoutMs, message) {
  let timer = null
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    }),
  ]).finally(() => clearTimeout(timer))
}

export class MaintenanceService {
  constructor(db) {
    this.db = db
    this.autoCheckTimer = null
    this.autoCheckFirstTimer = null
  }

  startAutoCheck(intervalMs = 6 * 60 * 60 * 1000) {
    if (this.autoCheckTimer !== null) return
    const run = () => {
      this.check().catch(() => {})
    }
    this.autoCheckFirstTimer = setTimeout(run, 5000)
    this.autoCheckFirstTimer.unref?.()
    this.autoCheckTimer = setInterval(run, intervalMs)
    this.autoCheckTimer.unref?.()
  }

  dispose() {
    if (this.autoCheckFirstTimer !== null) clearTimeout(this.autoCheckFirstTimer)
    if (this.autoCheckTimer !== null) clearInterval(this.autoCheckTimer)
    this.autoCheckFirstTimer = null
    this.autoCheckTimer = null
  }

  settings() {
    const raw = readSettings()
    return {
      backupDir: typeof raw.backupDir === 'string' && raw.backupDir.length > 0 ? raw.backupDir : backupsDir(),
      componentCheck: raw.componentCheck && typeof raw.componentCheck === 'object' ? raw.componentCheck : null,
    }
  }

  saveBackupDir(dir) {
    if (typeof dir !== 'string' || dir.trim().length === 0) throw Object.assign(new Error('backupDir must be a non-empty path'), { status: 400 })
    const resolved = path.resolve(dir.trim())
    try {
      ensureWritableDirectory(resolved)
    } catch (error) {
      throw Object.assign(new Error('backup directory is not writable: ' + (error instanceof Error ? error.message : String(error))), { status: 400 })
    }
    const current = this.settings()
    writeSettings({ backupDir: resolved, componentCheck: current.componentCheck })
    return this.settings()
  }

  components(settings = this.settings()) {
    const config = this.db.config || {}
    const installedPg = config.pgVersion || null
    const installedVector = config.pgvectorVersion || null
    const cache = settings.componentCheck || {}
    const latestPg = cache.postgres?.latest || null
    const latestVector = cache.pgvector?.latest || null
    return [
      {
        id: 'postgres',
        name: 'PostgreSQL',
        installedVersion: installedPg,
        latestVersion: latestPg,
        updateAvailable: installedPg !== null && latestPg !== null && compareVersions(latestPg, installedPg) > 0,
        binDir: config.binDir || null,
        checkedAt: cache.checkedAt || null,
        error: cache.postgres?.error || null,
        updatePolicy: 'manual',
      },
      {
        id: 'pgvector',
        name: 'pgvector',
        installedVersion: installedVector,
        latestVersion: latestVector,
        updateAvailable: installedVector !== null && latestVector !== null && compareVersions(latestVector, installedVector) > 0,
        binDir: config.binDir || null,
        checkedAt: cache.checkedAt || null,
        error: cache.pgvector?.error || null,
        updatePolicy: 'manual',
      },
    ]
  }

  async status() {
    let dbStatus = null
    try {
      dbStatus = await this.db.status()
    } catch {}
    return {
      installed: dbStatus?.installed ?? false,
      running: dbStatus?.running ?? false,
      port: dbStatus?.port ?? null,
      database: dbStatus?.database ?? null,
      components: this.components(),
      backupDir: this.settings().backupDir,
      backups: this.listBackups(),
    }
  }

  async check() {
    const settings = this.settings()
    const currentPg = this.db.config?.pgVersion || null
    const [pgResult, vectorResult] = await Promise.allSettled([latestPostgres(currentPg), latestPgvector()])
    const cache = {
      checkedAt: new Date().toISOString(),
      postgres: { latest: pgResult.status === 'fulfilled' ? pgResult.value : null, error: pgResult.status === 'rejected' ? String(pgResult.reason?.message || pgResult.reason) : null },
      pgvector: { latest: vectorResult.status === 'fulfilled' ? vectorResult.value : null, error: vectorResult.status === 'rejected' ? String(vectorResult.reason?.message || vectorResult.reason) : null },
    }
    writeSettings({ backupDir: settings.backupDir, componentCheck: cache })
    return {
      checkedAt: cache.checkedAt,
      components: this.components({ backupDir: settings.backupDir, componentCheck: cache }),
      errors: [cache.postgres.error, cache.pgvector.error].filter(Boolean),
    }
  }

  listBackups() {
    const dir = this.settings().backupDir
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter((name) => name.toLowerCase().endsWith('.dump'))
      .map((name) => {
        const file = path.join(dir, name)
        const stat = fs.statSync(file)
        return { name, path: file, size: stat.size, modifiedAt: stat.mtime.toISOString() }
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
  }

  async backup() {
    if (!this.db.installed) throw Object.assign(new Error('database is not installed'), { status: 409 })
    const status = await this.db.status()
    if (!status.running) throw Object.assign(new Error('database is not running'), { status: 409 })
    if (!this.db.credentials) throw Object.assign(new Error('database credentials are missing'), { status: 409 })
    const settings = this.settings()
    ensureWritableDirectory(settings.backupDir)
    const file = path.join(settings.backupDir, 'claybot-' + timestampForFile() + '.dump')
    const pgDump = path.join(this.db.config.binDir, 'pg_dump.exe')
    if (!fs.existsSync(pgDump)) throw new Error('pg_dump.exe not found in ' + this.db.config.binDir)
    const args = [
      '--no-password',
      '-Fc',
      '-h',
      '127.0.0.1',
      '-p',
      String(this.db.config.port),
      '-U',
      userForRole('service'),
      '-d',
      this.db.config.database || 'claybot',
      '-f',
      file,
    ]
    let stderr = ''
    await withTimeout(
      new Promise((resolve, reject) => {
        const child = spawn(pgDump, args, {
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe'],
          env: {
            ...process.env,
            PGPASSWORD: passwordForRole(this.db.credentials, 'service'),
            PGSSLMODE: 'disable',
          },
        })
        child.stderr.on('data', (chunk) => {
          stderr += chunk
        })
        child.on('error', reject)
        child.on('close', (code) => {
          if (code !== 0) reject(new Error('pg_dump failed with code ' + String(code) + (stderr ? ': ' + stderr.trim() : '')))
          else resolve()
        })
      }),
      5 * 60 * 1000,
      'pg_dump timed out',
    )
    const stat = fs.statSync(file)
    return { ok: true, file, size: stat.size, modifiedAt: stat.mtime.toISOString(), backupDir: settings.backupDir }
  }
}
