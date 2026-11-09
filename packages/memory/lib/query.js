import pg from 'pg'
import { CONSOLE_ROLES, passwordForRole, userForRole } from './roles.js'

const { Client } = pg

const MAX_SQL_LENGTH = 200000
const MAX_ROWS = 500
const STATEMENT_TIMEOUT_MS = 10000

function normalize(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return '\\x' + value.toString('hex')
  if (Array.isArray(value)) return value.map(normalize)
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype === Object.prototype || prototype === null) {
      const output = {}
      for (const [key, item] of Object.entries(value)) output[key] = normalize(item)
      return output
    }
    return String(value)
  }
  return value
}

function makeClient({ port, user, password }) {
  return new Client({
    host: '127.0.0.1',
    port,
    database: 'claybot',
    user,
    password,
    application_name: 'claybot-console',
    connectionTimeoutMillis: 5000,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS + 2000,
  })
}

export function allowedConsoleRole(role) {
  return CONSOLE_ROLES.includes(role)
}

export async function runSql({ port, credentials, role, sql }) {
  if (!allowedConsoleRole(role)) throw new Error('role is not allowed: ' + String(role))
  if (typeof sql !== 'string' || sql.trim().length === 0) throw new Error('SQL is empty')
  if (sql.length > MAX_SQL_LENGTH) throw new Error('SQL is too long (max ' + String(MAX_SQL_LENGTH) + ' chars)')
  const client = makeClient({
    port,
    user: userForRole(role),
    password: passwordForRole(credentials, role),
  })
  await client.connect()
  try {
    const raw = await client.query(sql)
    const results = Array.isArray(raw) ? raw : [raw]
    return {
      results: results.map((result) => {
        const rows = Array.isArray(result.rows) ? result.rows : []
        return {
          command: result.command ?? null,
          rowCount: typeof result.rowCount === 'number' ? result.rowCount : null,
          fields: Array.isArray(result.fields) ? result.fields.map((field) => field.name) : [],
          rows: rows.slice(0, MAX_ROWS).map((row) => normalize(row)),
          truncated: rows.length > MAX_ROWS,
        }
      }),
      maxRows: MAX_ROWS,
    }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function readCatalog({ port, credentials }) {
  const client = makeClient({
    port,
    user: userForRole('service'),
    password: passwordForRole(credentials, 'service'),
  })
  await client.connect()
  try {
    const roles = await client.query(
      "SELECT rolname, rolsuper, rolcanlogin, rolconnlimit FROM pg_roles WHERE rolname LIKE 'claybot%' OR rolname LIKE 'provider_%' ORDER BY rolname",
    )
    const schemas = await client.query(
      "SELECT nspname AS name, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname IN ('core','memory') OR nspname LIKE 'provider_%' ORDER BY nspname",
    )
    const sizes = await client.query(
      "SELECT n.nspname AS schema, pg_size_pretty(COALESCE(SUM(pg_total_relation_size(c.oid)),0)) AS size FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p','m') AND (n.nspname IN ('core','memory') OR n.nspname LIKE 'provider_%') GROUP BY n.nspname ORDER BY n.nspname",
    )
    const database = await client.query("SELECT pg_size_pretty(pg_database_size('claybot')) AS size")
    return {
      roles: roles.rows,
      schemas: schemas.rows,
      sizes: sizes.rows,
      databaseSize: database.rows[0]?.size ?? null,
    }
  } finally {
    await client.end().catch(() => {})
  }
}

export async function readConnections({ port, credentials }) {
  const client = makeClient({
    port,
    user: userForRole('service'),
    password: passwordForRole(credentials, 'service'),
  })
  await client.connect()
  try {
    const result = await client.query(
      "SELECT pid, usename, application_name, client_addr, client_port, datname, state, backend_start FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND backend_type = 'client backend' ORDER BY backend_start",
    )
    return {
      count: result.rows.length,
      connections: result.rows.map((row) => ({
        pid: row.pid,
        user: row.usename,
        database: row.datname,
        application: row.application_name || '',
        client: row.client_addr || '',
        port: row.client_port === null || row.client_port === undefined ? null : Number(row.client_port),
        state: row.state || '',
        since: row.backend_start ? new Date(row.backend_start).toISOString() : null,
      })),
    }
  } finally {
    await client.end().catch(() => {})
  }
}
