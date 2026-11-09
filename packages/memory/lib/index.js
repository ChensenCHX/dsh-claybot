import { DbService } from './db-service.js'
import { registerRoutes } from './api.js'

export const name = 'dsh-claybot-memory'
export const inject = ['connection']

export function apply(ctx) {
  const db = new DbService()
  registerRoutes(ctx, db)
  ctx.effect(() => async () => {
    await db.dispose()
  }, 'claybot-memory: database service')
  db.init().catch((error) => {
    db.lastError = error instanceof Error ? error.message : String(error)
  })
}
