import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createSession, deleteSession, getUserBySession, type Role, type User } from './db.js'
import { clearSessionCookie, parseCookies, sendError, setSessionCookie } from './http.js'

const sessionCookie = 'medinexus_session'

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionForUser(response: ServerResponse, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  createSession(userId, expiresAt, tokenHash(token))
  response.setHeader('Set-Cookie', setSessionCookie(token))
}

export function clearSession(request: IncomingMessage, response: ServerResponse) {
  const token = parseCookies(request)[sessionCookie]
  if (token) deleteSession(tokenHash(token))
  response.setHeader('Set-Cookie', clearSessionCookie())
}

export function currentUser(request: IncomingMessage): User | null {
  const token = parseCookies(request)[sessionCookie]
  return token ? getUserBySession(tokenHash(token)) : null
}

export function requireUser(request: IncomingMessage, response: ServerResponse) {
  const user = currentUser(request)
  if (!user) {
    sendError(response, 401, 'Sign in is required for this resource.', 'UNAUTHENTICATED')
    return null
  }
  return user
}

export function requireRole(user: User, response: ServerResponse, roles: Role[]) {
  if (!roles.includes(user.role)) {
    sendError(response, 403, 'Your role is not allowed to access this resource.', 'FORBIDDEN')
    return false
  }
  return true
}

