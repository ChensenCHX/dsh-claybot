const PREFIX = '/api/claybot/db'
const MAX_BODY_BYTES = 200000

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function failure(status, message, extra = {}) {
  return json({ error: { message, ...extra } }, status)
}

function errorPayload(error) {
  const payload = { message: error instanceof Error ? error.message : String(error) }
  if (error && typeof error === 'object') {
    for (const key of ['code', 'detail', 'hint', 'position', 'severity']) {
      if (error[key] !== undefined) payload[key] = error[key]
    }
  }
  return payload
}

async function readJson(request) {
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) throw Object.assign(new Error('request body is too large'), { status: 413 })
  if (text.length === 0) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw Object.assign(new Error('invalid JSON body'), { status: 400 })
  }
}

function queryParam(request, name) {
  return new URL(request.url).searchParams.get(name)
}

export function registerRoutes(ctx, db, maintenance) {
  const routes = [
    {
      path: PREFIX + '/status',
      methods: ['GET'],
      handler: async () => json(await db.status()),
    },
    {
      path: PREFIX + '/install',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('install requires confirm: true'), { status: 400 })
        if (db.installed) throw Object.assign(new Error('database is already installed'), { status: 409 })
        if (db.operation !== null) throw Object.assign(new Error('another database operation is running'), { status: 409 })
        db.install().catch(() => {})
        return json({ ok: true, status: await db.status() }, 202)
      },
    },
    {
      path: PREFIX + '/action',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        const action = body.action
        if (action === 'start') await db.start()
        else if (action === 'stop') await db.stop()
        else if (action === 'restart') await db.restart()
        else throw Object.assign(new Error('unknown action: ' + String(action)), { status: 400 })
        return json({ ok: true, status: await db.status() })
      },
    },
    {
      path: PREFIX + '/connection',
      methods: ['GET'],
      handler: async (request) => {
        const role = queryParam(request, 'role') || 'admin'
        return json({ connection: db.connection(role) })
      },
    },
    {
      path: PREFIX + '/reveal',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        return json(db.reveal(body.role || 'admin'))
      },
    },
    {
      path: PREFIX + '/catalog',
      methods: ['GET'],
      handler: async () => json(await db.catalog()),
    },
    {
      path: PREFIX + '/connections',
      methods: ['GET'],
      handler: async () => json(await db.connections()),
    },
    {
      path: PREFIX + '/components',
      methods: ['GET'],
      handler: async () => json(await maintenance.status()),
    },
    {
      path: PREFIX + '/components/check',
      methods: ['POST'],
      handler: async () => json(await maintenance.check()),
    },
    {
      path: PREFIX + '/backups',
      methods: ['GET', 'POST'],
      handler: async (request) => {
        if (request.method === 'GET') {
          return json({ backupDir: maintenance.settings().backupDir, backups: maintenance.listBackups() })
        }
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('backup requires confirm: true'), { status: 400 })
        return json(await maintenance.backup())
      },
    },
    {
      path: PREFIX + '/backups/settings',
      methods: ['PUT'],
      handler: async (request) => {
        const body = await readJson(request)
        const settings = maintenance.saveBackupDir(body.dir)
        return json({ ok: true, backupDir: settings.backupDir, backups: maintenance.listBackups() })
      },
    },
    {
      path: PREFIX + '/query',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        const role = body.role || 'admin'
        const sql = body.sql
        return json(await db.query(role, sql))
      },
    },
  ]

  for (const route of routes) {
    ctx.connection.fetch.register({
      path: route.path,
      methods: route.methods,
      requestBody: 'buffered',
      fetch: async (request) => {
        try {
          return await route.handler(request)
        } catch (error) {
          const status = typeof error?.status === 'number' ? error.status : 500
          return failure(status, errorPayload(error).message, errorPayload(error))
        }
      },
    })
  }
}
