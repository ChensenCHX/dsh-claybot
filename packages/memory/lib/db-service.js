import fs from 'node:fs'

import {
  CATALOG,
  install as installDatabase,
  installedRunning,
  startInstalled,
  stopInstalled,
} from './installer.js'
import { allowedConsoleRole, readCatalog, readConnections, runSql } from './query.js'
import { passwordForRole, userForRole } from './roles.js'
import { readConfig, readCredentials } from './paths.js'

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

export class DbService {
  constructor() {
    this.config = readConfig()
    this.credentials = readCredentials()
    this.operation = null
    this.lastError = null
    this.disposed = false
  }

  get installed() {
    return (
      this.config !== null &&
      typeof this.config.dataDir === 'string' &&
      typeof this.config.binDir === 'string' &&
      fs.existsSync(this.config.dataDir) &&
      fs.existsSync(this.config.binDir)
    )
  }

  async init() {
    if (!this.installed) return
    try {
      await this.start()
    } catch (error) {
      this.lastError = messageOf(error)
    }
  }

  async status() {
    let running = false
    if (this.installed) {
      try {
        running = await installedRunning(this.config)
      } catch {
        running = false
      }
    }
    return {
      installed: this.installed,
      running,
      version: this.config?.version ?? null,
      pgVersion: this.config?.pgVersion ?? CATALOG.pgVersion,
      pgvectorVersion: this.config?.pgvectorVersion ?? CATALOG.pgvectorVersion,
      port: this.config?.port ?? null,
      dataDir: this.config?.dataDir ?? null,
      binDir: this.config?.binDir ?? null,
      database: this.config?.database ?? 'claybot',
      installedAt: this.config?.installedAt ?? null,
      operation: this.operation,
      lastError: this.lastError,
      catalog: CATALOG,
    }
  }

  async install() {
    if (this.disposed) throw new Error('database service is disposed')
    if (this.installed) throw new Error('database is already installed')
    if (this.operation !== null) throw new Error('another database operation is running')
    this.lastError = null
    this.operation = {
      phase: 'downloading',
      message: '准备安装 PostgreSQL',
      progress: 0,
      startedAt: new Date().toISOString(),
    }
    try {
      const result = await installDatabase((update) => {
        this.operation = { ...this.operation, ...update }
      })
      this.config = result.config
      this.credentials = result.credentials
      this.operation = null
      return result
    } catch (error) {
      this.operation = null
      this.lastError = messageOf(error)
      throw error
    }
  }

  async start() {
    if (this.disposed) throw new Error('database service is disposed')
    if (!this.installed) throw new Error('database is not installed')
    if (await installedRunning(this.config)) return
    if (this.operation !== null) throw new Error('another database operation is running')
    this.operation = { phase: 'starting', message: '正在启动 PostgreSQL', progress: 0, startedAt: new Date().toISOString() }
    try {
      await startInstalled(this.config)
      this.lastError = null
    } catch (error) {
      this.lastError = messageOf(error)
      throw error
    } finally {
      this.operation = null
    }
  }

  async stop() {
    if (this.disposed) throw new Error('database service is disposed')
    if (!this.installed) throw new Error('database is not installed')
    if (!(await installedRunning(this.config))) return
    if (this.operation !== null) throw new Error('another database operation is running')
    this.operation = { phase: 'stopping', message: '正在停止 PostgreSQL', progress: 0, startedAt: new Date().toISOString() }
    try {
      await stopInstalled(this.config)
      this.lastError = null
    } catch (error) {
      this.lastError = messageOf(error)
      throw error
    } finally {
      this.operation = null
    }
  }

  async restart() {
    await this.stop()
    await this.start()
  }

  async query(role, sql) {
    if (!this.installed) throw new Error('database is not installed')
    if (this.credentials === null) throw new Error('database credentials are missing')
    return runSql({ port: this.config.port, credentials: this.credentials, role, sql })
  }

  async catalog() {
    if (!this.installed) throw new Error('database is not installed')
    if (this.credentials === null) throw new Error('database credentials are missing')
    return readCatalog({ port: this.config.port, credentials: this.credentials })
  }

  async connections() {
    if (!this.installed) throw new Error('database is not installed')
    if (this.credentials === null) throw new Error('database credentials are missing')
    return readConnections({ port: this.config.port, credentials: this.credentials })
  }

  connection(role = 'admin') {
    if (!this.installed) throw new Error('database is not installed')
    if (this.credentials === null) throw new Error('database credentials are missing')
    if (!allowedConsoleRole(role) && role !== 'service') throw new Error('role is not allowed: ' + String(role))
    return {
      host: '127.0.0.1',
      port: this.config.port,
      database: this.config.database ?? 'claybot',
      user: userForRole(role),
      role,
    }
  }

  reveal(role = 'admin') {
    if (!this.installed) throw new Error('database is not installed')
    if (this.credentials === null) throw new Error('database credentials are missing')
    if (role !== 'admin') throw new Error('only the admin role can be revealed from the panel')
    return { role, password: passwordForRole(this.credentials, role) }
  }

  async dispose() {
    if (this.disposed) return
    this.disposed = true
    if (this.installed) {
      try {
        if (await installedRunning(this.config)) await stopInstalled(this.config)
      } catch {}
    }
  }
}
