import { ConfigService } from './config.js'
import { DbService } from './db-service.js'
import { EmbeddingService } from './embedding.js'
import { MaintenanceService } from './maintenance.js'
import { registerRoutes } from './api.js'

export const name = 'dsh-claybot-memory'
export const inject = ['connection']

export function apply(ctx) {
  const db = new DbService()
  const maintenance = new MaintenanceService(db)
  const config = new ConfigService(maintenance, db)
  const embedding = new EmbeddingService(config)
  registerRoutes(ctx, db, maintenance, config, embedding)
  maintenance.startAutoCheck()
  embedding.init().catch((error) => {
    embedding.lastError = error instanceof Error ? error.message : String(error)
  })
  ctx.effect(() => async () => {
    maintenance.dispose()
    try { await embedding.stop() } catch {}
    await db.dispose()
  }, 'claybot-memory: database service')
  db.init().catch((error) => {
    db.lastError = error instanceof Error ? error.message : String(error)
  })
}
