import { ConfigService } from './config.js'
import { DbService } from './db-service.js'
import { EmbeddingService } from './embedding.js'
import { MaintenanceService } from './maintenance.js'
import { MemoryMigration } from './memory-migration.js'
import { MemorySchema } from './memory-schema.js'
import { registerRoutes } from './api.js'
import { createMemoryTools, registerMemoryTools } from './tools.js'

export const name = 'dsh-claybot-memory'
export const inject = ['connection', 'tools']

export function apply(ctx) {
  const db = new DbService()
  const maintenance = new MaintenanceService(db)
  const config = new ConfigService(maintenance, db)
  const embedding = new EmbeddingService(config)
  const memorySchema = new MemorySchema(db, config)
  const memoryMigration = new MemoryMigration(db, config, embedding, memorySchema)
  registerRoutes(ctx, db, maintenance, config, embedding, memorySchema, memoryMigration)
  ctx.effect(() => {
    const disposers = registerMemoryTools(ctx, createMemoryTools(db, config, embedding, ctx))
    return () => {
      for (const dispose of disposers) {
        try { dispose() } catch {}
      }
    }
  }, 'claybot-memory: tools')
  maintenance.startAutoCheck()
  embedding.init().catch((error) => {
    embedding.lastError = error instanceof Error ? error.message : String(error)
  })
  ctx.effect(() => async () => {
    maintenance.dispose()
    try { await embedding.stop() } catch {}
    await db.dispose()
  }, 'claybot-memory: database service')
  db.init()
    .then(async () => {
      await memorySchema.ensure()
      await memoryMigration.recoverInterrupted()
    })
    .catch((error) => {
      memorySchema.lastError = error instanceof Error ? error.message : String(error)
    })
}
