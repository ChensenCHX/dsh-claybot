const PREFIX = '/api/claybot/db'
const CONFIG_PREFIX = '/api/claybot'
const EMBEDDING_PREFIX = '/api/claybot/embedding'
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

export function registerRoutes(ctx, db, maintenance, config, embedding, memorySchema, memoryMigration) {
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
    {
      path: CONFIG_PREFIX + '/config',
      methods: ['GET', 'PUT'],
      handler: async (request) => {
        if (request.method === 'GET') return json(config.read())
        const body = await readJson(request)
        return json(config.save(body))
      },
    },
    {
      path: CONFIG_PREFIX + '/config/export',
      methods: ['GET'],
      handler: async (request) => {
        const secrets = queryParam(request, 'secrets') === '1'
        return json(config.exportSheet({ includeSecrets: secrets }))
      },
    },
    {
      path: CONFIG_PREFIX + '/config/import',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        if (!body || typeof body !== 'object' || !body.sheet || typeof body.sheet !== 'object') {
          throw Object.assign(new Error('import requires a config sheet'), { status: 400 })
        }
        return json(config.importSheet(body.sheet, { apply: body.apply === true }))
      },
    },
    {
      path: CONFIG_PREFIX + '/config/devices',
      methods: ['GET'],
      handler: async () => json(config.devices()),
    },
    {
      path: CONFIG_PREFIX + '/memory/schema',
      methods: ['GET', 'POST'],
      handler: async (request) => {
        if (request.method === 'GET') return json(await memorySchema.status())
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('memory schema ensure requires confirm: true'), { status: 400 })
        return json(await memorySchema.ensure())
      },
    },
    {
      path: CONFIG_PREFIX + '/memory/schema/migrations',
      methods: ['GET', 'POST'],
      handler: async (request) => {
        if (request.method === 'GET') {
          const status = await memorySchema.status()
          return json({ migrations: status.migrations || [], active: status.migration || null })
        }
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('memory migration requires confirm: true'), { status: 400 })
        const migration = await memoryMigration.start()
        return json({ ok: true, migration }, 202)
      },
    },
    {
      path: CONFIG_PREFIX + '/memory/schema/migrations/resume',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('memory migration resume requires confirm: true'), { status: 400 })
        if (body.id === undefined || body.id === null) throw Object.assign(new Error('memory migration id is required'), { status: 400 })
        const migration = await memoryMigration.resume(Number(body.id))
        return json({ ok: true, migration }, 202)
      },
    },
    {
      path: EMBEDDING_PREFIX + '/status',
      methods: ['GET'],
      handler: async () => json(await embedding.status()),
    },
    {
      path: EMBEDDING_PREFIX + '/browse',
      methods: ['GET'],
      handler: async (request) => json(embedding.browse(queryParam(request, 'path') || '')),
    },
    {
      path: EMBEDDING_PREFIX + '/gguf',
      methods: ['GET'],
      handler: async (request) => json(embedding.inspectGguf(queryParam(request, 'path') || '')),
    },
    {
      path: EMBEDDING_PREFIX + '/monitor',
      methods: ['GET'],
      handler: async () => json(await embedding.monitor()),
    },
    {
      path: EMBEDDING_PREFIX + '/probe',
      methods: ['POST'],
      handler: async () => json(await embedding.probe()),
    },
    {
      path: EMBEDDING_PREFIX + '/install',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('install requires confirm: true'), { status: 400 })
        if (embedding.operation !== null) throw Object.assign(new Error('another embedding operation is running'), { status: 409 })
        embedding.install(body.backend || 'vulkan').catch(() => {})
        return json({ ok: true, status: await embedding.status() }, 202)
      },
    },
    {
      path: EMBEDDING_PREFIX + '/models/download',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        if (body.confirm !== true) throw Object.assign(new Error('download requires confirm: true'), { status: 400 })
        if (embedding.operation !== null) throw Object.assign(new Error('another embedding operation is running'), { status: 409 })
        embedding.downloadModel(body.modelId).catch(() => {})
        return json({ ok: true, status: await embedding.status() }, 202)
      },
    },
    {
      path: EMBEDDING_PREFIX + '/action',
      methods: ['POST'],
      handler: async (request) => {
        const body = await readJson(request)
        if (body.action === 'start') await embedding.start()
        else if (body.action === 'stop') await embedding.stop()
        else if (body.action === 'restart') await embedding.restart()
        else throw Object.assign(new Error('unknown action: ' + String(body.action)), { status: 400 })
        return json({ ok: true, status: await embedding.status() })
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
