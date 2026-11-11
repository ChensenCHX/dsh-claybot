import { registerGrantTools } from './tools-grant.js'

export const name = 'dsh-claybot'
export const inject = ['tools']

export function apply(ctx) {
  ctx.effect(() => {
    const { disposers } = registerGrantTools(ctx)
    return () => {
      for (const dispose of disposers) {
        try { dispose() } catch {}
      }
    }
  }, 'claybot: tool grants')
}

export { ToolGrants } from './tool-grants.js'
