import { DbService } from './db-service.js'
import { MaintenanceService } from './maintenance.js'
import { registerRoutes } from './api.js'

export const name = 'dsh-claybot-memory'
export const inject = ['connection']

export function apply(ctx) {
  const db = new DbService()
  const maintenance = new MaintenanceService(db)
  registerRoutes(ctx, db, maintenance)
  maintenance.startAutoCheck()
  ctx.effect(() => async () => {
    maintenance.dispose()
    await db.dispose()
  }, 'claybot-memory: database service')
  db.init().catch((error) => {
    db.lastError = error instanceof Error ? error.message : String(error)
  })
}
