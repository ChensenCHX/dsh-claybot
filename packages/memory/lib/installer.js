import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import pg from 'pg'

import {
  binRoot,
  buildDir,
  dataDir,
  downloadsDir,
  ensureDir,
  ensureLayout,
  pgLogPath,
  postgresRoot,
  stateDir,
  writeConfig,
  writeCredentials,
} from './paths.js'

const { Client } = pg

export const CATALOG = {
  version: '18.6',
  platform: 'win32-x64',
  fileName: 'postgresql-18.6-5-windows-x64-binaries.zip',
  url: 'https://get.enterprisedb.com/postgresql/postgresql-18.6-5-windows-x64-binaries.zip',
  sha256: 'e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2',
  size: 384620317,
  pgVersion: '18.6',
  pgvectorVersion: '0.8.7',
  license: 'PostgreSQL License + pgvector PostgreSQL License',
  source: 'EDB PostgreSQL 18.6 Windows x64 binaries',
}

const PGVECTOR_SOURCE = {
  version: '0.8.7',
  fileName: 'pgvector-0.8.7.zip',
  url: 'https://codeload.github.com/pgvector/pgvector/zip/refs/tags/v0.8.7',
  sha256: '7b3b8188a5cc0aa96db3c8f3fca1e78a8a612c46545065490c76448705c6b29e',
  size: 219919,
  label: 'pgvector 源码',
}

function runExecutable(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      windowsHide: true,
      stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
    })
    const timer = options.timeoutMs
      ? setTimeout(() => {
          child.kill()
          reject(new Error(path.basename(exe) + ' timed out'))
        }, options.timeoutMs)
      : undefined
    child.on('error', (error) => {
      if (timer !== undefined) clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      if (timer !== undefined) clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(path.basename(exe) + ' exited with ' + String(code) + '\n' + stdout + stderr))
    })
  })
}

function runExitCode(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

function tarExecutable() {
  if (process.platform === 'win32') {
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const candidate = path.join(systemRoot, 'System32', 'tar.exe')
    if (fs.existsSync(candidate)) return candidate
  }
  return 'tar'
}

function findInitdb(root) {
  const queue = [root]
  while (queue.length > 0) {
    const current = queue.shift()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isFile() && entry.name.toLowerCase() === 'initdb.exe') {
        return { binDir: path.dirname(full), root: path.dirname(path.dirname(full)) }
      }
      if (entry.isDirectory()) queue.push(full)
    }
  }
  throw new Error('PostgreSQL archive does not contain bin/initdb.exe')
}

export function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

export function curlExecutable() {
  if (process.platform === 'win32') {
    const candidate = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'curl.exe')
    if (fs.existsSync(candidate)) return candidate
  }
  return 'curl'
}

export function detectHttpProxy() {
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
    const value = process.env[name]
    if (typeof value === 'string' && value.length > 0) return value
  }
  if (process.platform !== 'win32') return null
  try {
    const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'
    const enabled = spawnSync('reg.exe', ['query', key, '/v', 'ProxyEnable'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    if (enabled.status !== 0 || !/0x1\b/.test(enabled.stdout || '')) return null
    const server = spawnSync('reg.exe', ['query', key, '/v', 'ProxyServer'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    if (server.status !== 0) return null
    const match = /ProxyServer\s+REG_SZ\s+(.+)\s*$/m.exec(server.stdout || '')
    if (match === null) return null
    const raw = match[1].trim()
    if (raw.includes(';')) {
      const parts = raw.split(';').map((part) => part.trim()).filter(Boolean)
      const chosen = parts.find((part) => part.toLowerCase().startsWith('https=')) || parts.find((part) => part.toLowerCase().startsWith('http='))
      if (chosen === undefined) return null
      const value = chosen.slice(chosen.indexOf('=') + 1)
      return value.length > 0 ? value : null
    }
    return raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

function downloadViaCurl(destination, proxy, onProgress, label, source) {
  const total = source.size
  return new Promise((resolve, reject) => {
    const args = ['-L', '--fail', '--show-error', '--silent', '--retry', '1', '--retry-delay', '2', '--output', destination]
    if (proxy !== null) args.push('--proxy', proxy)
    args.push(source.url)
    const child = spawn(curlExecutable(), args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (chunk) => {
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
        message: '正在' + label + '下载' + source.label,
        progress: total > 0 ? Math.min(0.99, size / total) : null,
        received: size,
        total,
      })
      if (Date.now() - startedAt > 20 * 60 * 1000) child.kill()
    }, 1000)
    child.on('error', (error) => {
      clearInterval(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearInterval(timer)
      if (code !== 0) {
        reject(new Error('curl exited with ' + String(code) + '\n' + stderr))
        return
      }
      resolve()
    })
  })
}

function verifyDownloaded(file, source, kind) {
  const size = fs.statSync(file).size
  if (size !== source.size) throw new Error(kind + ' size mismatch: expected ' + source.size + ', got ' + size)
  const digest = sha256File(file)
  if (digest !== source.sha256) throw new Error(kind + ' checksum mismatch: expected ' + source.sha256 + ', got ' + digest)
}

async function downloadSource(source, onProgress, kind) {
  ensureDir(downloadsDir())
  const destination = path.join(downloadsDir(), source.fileName)
  if (fs.existsSync(destination) && fs.statSync(destination).size === source.size) {
    const digest = sha256File(destination)
    if (digest === source.sha256) {
      onProgress?.({ phase: 'downloading', message: '已存在' + kind + '，跳过下载', progress: 1 })
      return destination
    }
  }
  fs.rmSync(destination, { force: true })
  const proxy = detectHttpProxy()
  const attempts = proxy === null ? [{ proxy: null, label: '直连' }] : [{ proxy, label: '代理' }, { proxy: null, label: '直连' }]
  let lastError = null
  for (const attempt of attempts) {
    try {
      await downloadViaCurl(destination, attempt.proxy, onProgress, attempt.label, source)
      verifyDownloaded(destination, source, kind)
      onProgress?.({ phase: 'downloading', message: '下载完成', progress: 1, received: source.size, total: source.size })
      return destination
    } catch (error) {
      lastError = error
      fs.rmSync(destination, { force: true })
    }
  }
  throw lastError instanceof Error ? lastError : new Error('download failed')
}

async function downloadArchive(onProgress) {
  return downloadSource({ ...CATALOG, label: 'PostgreSQL 安装包' }, onProgress, 'PostgreSQL 安装包')
}

export async function extractArchive(archive, destination) {
  ensureDir(destination)
  const isZip = archive.toLowerCase().endsWith('.zip')
  const args = isZip ? ['-xf', archive, '-C', destination] : ['-xzf', archive, '-C', destination]
  await runExecutable(tarExecutable(), args, { timeoutMs: 300000 })
}

function pgvectorBuildRoot() {
  return path.join(buildDir(), 'pgvector-' + PGVECTOR_SOURCE.version)
}

function findVcvars64() {
  const candidates = [
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Enterprise\\VC\\Auxiliary\\Build\\vcvars64.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\VC\\Auxiliary\\Build\\vcvars64.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Auxiliary\\Build\\vcvars64.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Auxiliary\\Build\\vcvars64.bat',
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe'
  if (fs.existsSync(vswhere)) {
    const result = spawnSync(
      vswhere,
      ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'],
      { encoding: 'utf8', windowsHide: true, timeout: 10000 },
    )
    const installation = (result.stdout || '').trim().split(/\r?\n/)[0]
    if (installation) {
      const candidate = path.join(installation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

async function buildPgvector(root, sourceDir, onProgress) {
  const vcvars = findVcvars64()
  if (vcvars === null) {
    throw new Error('未找到 Visual Studio 2022 C++ 构建工具；pgvector 需要本地编译，请安装 VS2022 Build Tools 的“使用 C++ 的桌面开发”工作负载。')
  }
  const buildRoot = pgvectorBuildRoot()
  ensureDir(buildRoot)
  const script = path.join(buildRoot, 'build.cmd')
  fs.writeFileSync(
    script,
    [
      '@echo off',
      'call "' + vcvars + '"',
      'if errorlevel 1 exit /b 1',
      'set "PGROOT=' + root + '"',
      'cd /d "' + sourceDir + '"',
      'nmake /F Makefile.win',
      'if errorlevel 1 exit /b 1',
      'nmake /F Makefile.win install',
      'if errorlevel 1 exit /b 1',
    ].join('\r\n'),
    'utf8',
  )
  onProgress?.({ phase: 'building', message: '正在本地编译 pgvector 扩展', progress: null })
  let output = ''
  let exitCode = 0
  await new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/d', '/s', '/c', script], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout?.on('data', (chunk) => {
      output += chunk
    })
    child.stderr?.on('data', (chunk) => {
      output += chunk
    })
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('pgvector build timed out'))
    }, 15 * 60 * 1000)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      exitCode = code
      resolve()
    })
  })
  const log = path.join(buildRoot, 'build.log')
  fs.writeFileSync(log, output, 'utf8')
  if (exitCode !== 0) {
    throw new Error('pgvector build failed; see ' + log + '\n' + (output.length > 4000 ? output.slice(-4000) : output))
  }
  if (!fs.existsSync(path.join(root, 'lib', 'vector.dll'))) throw new Error('pgvector build did not produce lib/vector.dll; see ' + log)
  if (!fs.existsSync(path.join(root, 'share', 'extension', 'vector.control'))) throw new Error('pgvector build did not install vector.control; see ' + log)
  onProgress?.({ phase: 'building', message: 'pgvector 编译完成', progress: 1 })
}

async function ensurePgvector(root, onProgress) {
  const dll = path.join(root, 'lib', 'vector.dll')
  const control = path.join(root, 'share', 'extension', 'vector.control')
  if (fs.existsSync(dll) && fs.existsSync(control)) return
  const archive = await downloadSource(PGVECTOR_SOURCE, onProgress, 'pgvector 源码')
  const buildRoot = pgvectorBuildRoot()
  const sourceDir = path.join(buildRoot, 'pgvector-' + PGVECTOR_SOURCE.version)
  if (!fs.existsSync(path.join(sourceDir, 'Makefile.win'))) {
    fs.rmSync(sourceDir, { recursive: true, force: true })
    ensureDir(buildRoot)
    await extractArchive(archive, buildRoot)
  }
  if (!fs.existsSync(path.join(sourceDir, 'Makefile.win'))) {
    throw new Error('pgvector 源码解压后缺少 Makefile.win')
  }
  await buildPgvector(root, sourceDir, onProgress)
}

function pruneBundledExtras(root) {
  for (const name of [
    'pgAdmin 4',
    'StackBuilder',
    'doc',
    'commandlinetools_3rd_party_licenses.txt',
    'pgAdmin_3rd_party_licenses.txt',
    'pgAdmin_license.txt',
    'StackBuilder_3rd_party_licenses.txt',
  ]) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true })
  }
}

export async function ensureBinaries(onProgress) {
  const final = binRoot(CATALOG.version)
  const existing = path.join(final, 'bin', 'initdb.exe')
  if (fs.existsSync(existing)) {
    await ensurePgvector(final, onProgress)
    pruneBundledExtras(final)
    return { root: final, binDir: path.join(final, 'bin') }
  }

  const archive = await downloadArchive(onProgress)
  onProgress?.({ phase: 'verifying', message: '正在校验安装包', progress: 1 })
  const digest = sha256File(archive)
  if (digest !== CATALOG.sha256) throw new Error('checksum mismatch')

  onProgress?.({ phase: 'extracting', message: '正在解压 PostgreSQL', progress: 0 })
  const temp = path.join(postgresRoot(), CATALOG.version + '.tmp-' + process.pid + '-' + Date.now())
  ensureDir(temp)
  try {
    await extractArchive(archive, temp)
    const found = findInitdb(temp)
    fs.rmSync(final, { recursive: true, force: true })
    ensureDir(postgresRoot())
    fs.renameSync(found.root, final)
    const binDir = path.join(final, 'bin')
    if (!fs.existsSync(path.join(binDir, 'initdb.exe'))) throw new Error('extracted PostgreSQL has no bin/initdb.exe')
    await ensurePgvector(final, onProgress)
    pruneBundledExtras(final)
    return { root: final, binDir }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
}

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"'
}

function quoteLiteral(value) {
  return "'" + String(value).replace(/'/g, "''") + "'"
}

function randomPassword() {
  return Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(24))).toString('base64url')
}

async function ensureRole(client, name, password, superuser) {
  const found = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [name])
  const attributes = superuser
    ? 'LOGIN SUPERUSER PASSWORD '
    : 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10 PASSWORD '
  if (found.rowCount === 0) {
    await client.query('CREATE ROLE ' + quoteIdent(name) + ' ' + attributes + quoteLiteral(password))
    return
  }
  await client.query(
    'ALTER ROLE ' + quoteIdent(name) + ' WITH LOGIN PASSWORD ' + quoteLiteral(password) + (superuser ? ' SUPERUSER' : ' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 10'),
  )
}

async function provision(port, credentials) {
  const service = new Client({
    host: '127.0.0.1',
    port,
    database: 'postgres',
    user: 'claybot_service',
    password: credentials.service,
    connectionTimeoutMillis: 10000,
  })
  await service.connect()
  try {
    await ensureRole(service, 'claybot_service', credentials.service, true)
    await ensureRole(service, 'claybot_admin', credentials.admin, true)
    await ensureRole(service, 'claybot_core', credentials.core, false)
    await ensureRole(service, 'claybot_memory', credentials.memory, false)

    const db = await service.query("SELECT 1 FROM pg_database WHERE datname = 'claybot'")
    if (db.rowCount === 0) {
      await service.query('CREATE DATABASE claybot OWNER claybot_admin')
    }
    await service.query('REVOKE CONNECT ON DATABASE claybot FROM PUBLIC')
    await service.query('GRANT CONNECT ON DATABASE claybot TO claybot_admin, claybot_core, claybot_memory')
  } finally {
    await service.end()
  }

  const claybot = new Client({
    host: '127.0.0.1',
    port,
    database: 'claybot',
    user: 'claybot_service',
    password: credentials.service,
    connectionTimeoutMillis: 10000,
  })
  await claybot.connect()
  try {
    await claybot.query('CREATE SCHEMA IF NOT EXISTS core AUTHORIZATION claybot_core')
    await claybot.query('CREATE SCHEMA IF NOT EXISTS memory AUTHORIZATION claybot_memory')
    await claybot.query('CREATE EXTENSION IF NOT EXISTS vector')
    await claybot.query('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    await claybot.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
    await claybot.query('GRANT USAGE ON SCHEMA public TO claybot_admin, claybot_core, claybot_memory')
    await claybot.query('ALTER ROLE claybot_core SET search_path = core, public')
    await claybot.query('ALTER ROLE claybot_memory SET search_path = memory, public')
  } finally {
    await claybot.end()
  }
}

async function configure(data, port) {
  const configFile = path.join(data, 'postgresql.conf')
  fs.appendFileSync(
    configFile,
    '\n# ClayBot\nlisten_addresses = \'127.0.0.1\'\nport = ' + String(port) + '\nmax_connections = 100\n',
    'utf8',
  )
  const hbaFile = path.join(data, 'pg_hba.conf')
  fs.writeFileSync(
    hbaFile,
    '# ClayBot: local connections only\nhost all all 127.0.0.1/32 scram-sha-256\nhost all all ::1/128 scram-sha-256\n',
    'utf8',
  )
}

export async function pickPort(start = 54329) {
  for (let port = start; port < start + 100; port += 1) {
    const free = await new Promise((resolve) => {
      const server = net.createServer()
      server.once('error', () => resolve(false))
      server.once('listening', () => server.close(() => resolve(true)))
      server.listen(port, '127.0.0.1')
    })
    if (free) return port
  }
  throw new Error('no free PostgreSQL port found')
}

export async function startServer(binDir, data, port) {
  ensureDir(path.dirname(pgLogPath()))
  await runExecutable(
    path.join(binDir, 'pg_ctl.exe'),
    ['-D', data, '-l', pgLogPath(), '-o', '-p ' + String(port), 'start', '-w'],
    { timeoutMs: 90000, stdio: 'ignore' },
  )
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ready = await runExitCode(path.join(binDir, 'pg_isready.exe'), ['-h', '127.0.0.1', '-p', String(port)])
    if (ready.code === 0) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('PostgreSQL did not become ready')
}

export async function stopServer(binDir, data) {
  await runExecutable(path.join(binDir, 'pg_ctl.exe'), ['-D', data, '-m', 'fast', 'stop', '-w'], { timeoutMs: 60000 })
}

export async function serverRunning(binDir, data) {
  if (!fs.existsSync(path.join(binDir, 'pg_ctl.exe')) || !fs.existsSync(data)) return false
  const result = await runExitCode(path.join(binDir, 'pg_ctl.exe'), ['-D', data, 'status'])
  return result.code === 0
}

export async function install(onProgress) {
  ensureLayout()
  const data = dataDir()
  if (fs.existsSync(data) && fs.readdirSync(data).length > 0) {
    throw new Error('data directory already exists; refusing to overwrite: ' + data)
  }

  const binaries = await ensureBinaries(onProgress)
  const port = await pickPort()
  const credentials = {
    service: randomPassword(),
    admin: randomPassword(),
    core: randomPassword(),
    memory: randomPassword(),
  }

  let started = false
  let createdData = false
  try {
    if (!fs.existsSync(data)) {
      ensureDir(data)
      createdData = true
    }
    onProgress?.({ phase: 'initdb', message: '正在初始化数据库', progress: 0 })
    const passwordFile = path.join(stateDir(), 'initdb.pw-' + process.pid)
    fs.writeFileSync(passwordFile, credentials.service + '\n', { mode: 0o600 })
    try {
      await runExecutable(
        path.join(binaries.binDir, 'initdb.exe'),
        [
          '-D',
          data,
          '-U',
          'claybot_service',
          '--auth=scram-sha-256',
          '--pwfile=' + passwordFile,
          '-E',
          'UTF8',
          '--locale=C',
        ],
        { timeoutMs: 180000 },
      )
    } finally {
      fs.rmSync(passwordFile, { force: true })
    }

    configure(data, port)
    onProgress?.({ phase: 'starting', message: '正在启动 PostgreSQL', progress: 0 })
    await startServer(binaries.binDir, data, port)
    started = true
    onProgress?.({ phase: 'provisioning', message: '正在创建角色、schema 与扩展', progress: 0 })
    await provision(port, credentials)

    const config = {
      version: CATALOG.version,
      pgVersion: CATALOG.pgVersion,
      pgvectorVersion: CATALOG.pgvectorVersion,
      port,
      binDir: binaries.binDir,
      dataDir: data,
      database: 'claybot',
      installedAt: new Date().toISOString(),
    }
    writeConfig(config)
    writeCredentials(credentials)
    onProgress?.({ phase: 'ready', message: 'PostgreSQL 已就绪', progress: 1 })
    return { config, credentials }
  } catch (error) {
    if (started) {
      try {
        await stopServer(binaries.binDir, data)
      } catch {}
    }
    if (createdData) {
      try {
        fs.rmSync(data, { recursive: true, force: true })
      } catch {}
    }
    throw error
  }
}

export async function startInstalled(config) {
  await startServer(config.binDir, config.dataDir, config.port)
}

export async function stopInstalled(config) {
  await stopServer(config.binDir, config.dataDir)
}

export async function installedRunning(config) {
  return serverRunning(config.binDir, config.dataDir)
}

export { provision as provisionRolesForTest }
