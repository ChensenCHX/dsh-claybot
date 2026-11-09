import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const CATALOG_VERSION = '0.3.1'

export function dshHome() {
  return process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
}

export function stateDir() {
  return process.env.CLAYBOT_STATE_DIR || path.join(dshHome(), 'claybot')
}

export function dbRoot() {
  return path.join(stateDir(), 'db')
}

export function postgresRoot() {
  return path.join(dbRoot(), 'postgres')
}

export function binRoot(version = CATALOG_VERSION) {
  return path.join(postgresRoot(), version)
}

export function dataDir() {
  return path.join(dbRoot(), 'data')
}

export function downloadsDir() {
  return path.join(dbRoot(), 'downloads')
}

export function buildDir() {
  return path.join(dbRoot(), 'build')
}

export function settingsPath() {
  return path.join(dbRoot(), 'settings.json')
}

export function backupsDir() {
  return path.join(stateDir(), 'backups')
}

export function logsDir() {
  return path.join(dbRoot(), 'logs')
}

export function configPath() {
  return path.join(dbRoot(), 'config.json')
}

export function credentialsPath() {
  return path.join(dbRoot(), 'credentials.json')
}

export function pgLogPath() {
  return path.join(logsDir(), 'postgres.log')
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function ensureLayout() {
  ensureDir(dbRoot())
  ensureDir(postgresRoot())
  ensureDir(downloadsDir())
  ensureDir(buildDir())
  ensureDir(logsDir())
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJson(file, value, mode = 0o600) {
  ensureDir(path.dirname(file))
  const tmp = file + '.tmp-' + process.pid + '-' + Date.now()
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode })
  fs.renameSync(tmp, file)
}

export function readSettings() {
  return readJson(settingsPath(), {})
}

export function writeSettings(value) {
  writeJson(settingsPath(), value)
}

export function readConfig() {
  return readJson(configPath(), null)
}

export function writeConfig(config) {
  writeJson(configPath(), config)
}

export function readCredentials() {
  return readJson(credentialsPath(), null)
}

export function writeCredentials(credentials) {
  writeJson(credentialsPath(), credentials)
}
