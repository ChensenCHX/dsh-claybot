export const ROLE_USERS = {
  service: 'claybot_service',
  admin: 'claybot_admin',
  core: 'claybot_core',
  memory: 'claybot_memory',
}

export const CONSOLE_ROLES = ['admin', 'core', 'memory']

export function userForRole(role) {
  const user = ROLE_USERS[role]
  if (user === undefined) throw new Error('unknown role: ' + String(role))
  return user
}

export function passwordForRole(credentials, role) {
  if (credentials === null || credentials === undefined) throw new Error('database credentials are not initialized')
  const password = credentials[role]
  if (typeof password !== 'string' || password.length === 0) throw new Error('database credentials are missing role: ' + role)
  return password
}

export function providerKindToName(kind) {
  const value = String(kind).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (value.length === 0) throw new Error('provider kind is empty')
  return value
}

export function providerRoleAndSchema(kind) {
  const name = providerKindToName(kind)
  return { role: 'provider_' + name, user: 'claybot_provider_' + name, schema: 'provider_' + name }
}

export function generatePassword() {
  return randomPassword()
}

function randomPassword() {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}
