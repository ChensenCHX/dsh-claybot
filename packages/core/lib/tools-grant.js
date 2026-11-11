import { ToolGrants } from './tool-grants.js'

const SESSION_ID_DESCRIPTION = '目标会话 id（session id）；该会话的 claybot 工具访问权会被修改'

function textBlock(text) {
  return [{ type: 'text', text }]
}

function listText(grants) {
  return grants.sessionId + ' | all=' + String(grants.all) + ' plugins=[' + grants.plugins.join(',') + '] tools=[' + grants.tools.join(',') + ']'
}

function sessionIdOutput() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      sessionId: { type: 'string' },
      all: { type: 'boolean' },
      plugins: { type: 'array', items: { type: 'string' } },
      tools: { type: 'array', items: { type: 'string' } },
      sessions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sessionId: { type: 'string' },
            all: { type: 'boolean' },
            plugins: { type: 'array', items: { type: 'string' } },
            tools: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }
}

export function createGrantTools(grants) {
  const grantTool = {
    name: 'claybot-grant-access',
    description: '授予某个会话访问 claybot 工具集的权限。默认放开全部 claybot 工具；也可以只放开指定插件或指定工具。授权后该会话下一个 step 即可使用对应工具。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: SESSION_ID_DESCRIPTION },
        plugins: { type: 'array', items: { type: 'string' }, description: '只放开这些插件提供的工具（插件名取工具名的第一段，如 memory）' },
        tools: { type: 'array', items: { type: 'string' }, description: '只放开这些具体工具名' },
      },
      required: ['sessionId'],
    },
    output: {
      schema: sessionIdOutput(),
      render(_args, value) {
        const lines = ['[claybot-grant-access] granted ' + listText(value)]
        lines.push('total sessions=' + String(value.sessions.length))
        return textBlock(lines.join('\n'))
      },
    },
    async execute(args) {
      const granted = grants.grant(args.sessionId, { plugins: args.plugins, tools: args.tools })
      return { ...granted, sessions: grants.list() }
    },
  }

  const revokeTool = {
    name: 'claybot-revoke-access',
    description: '撤销某个会话对 claybot 工具集的访问权限。默认撤销该会话的全部 claybot 授权；也可以只撤销指定插件或指定工具。撤销后该会话下一个 step 立即失去对应工具。',
    parameters: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: SESSION_ID_DESCRIPTION },
        plugins: { type: 'array', items: { type: 'string' }, description: '只撤销这些插件的授权' },
        tools: { type: 'array', items: { type: 'string' }, description: '只撤销这些具体工具名的授权' },
      },
      required: ['sessionId'],
    },
    output: {
      schema: sessionIdOutput(),
      render(_args, value) {
        const lines = ['[claybot-revoke-access] revoked ' + listText(value)]
        lines.push('total sessions=' + String(value.sessions.length))
        return textBlock(lines.join('\n'))
      },
    },
    async execute(args) {
      const revoked = grants.revoke(args.sessionId, { plugins: args.plugins, tools: args.tools })
      return { ...revoked, sessions: grants.list() }
    },
  }

  return [grantTool, revokeTool]
}

export function registerGrantTools(ctx) {
  const grants = new ToolGrants()
  const tools = createGrantTools(grants)
  const disposers = tools.map((definition) => ctx.tools.register(definition))
  return { grants, disposers }
}
