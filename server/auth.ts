import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createSession, deleteSession, deleteUserSessions, getUserBySession, type Role, type User } from './db'
import { clearSessionCookie, parseCookies, sendError, setSessionCookie } from './http'

const sessionCookie = 'medinexus_session'

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function normaliseSessionToken(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const token = value.trim()
  return token.length > 0 ? token : null
}

export function sessionForUser(response: ServerResponse, userId: string) {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  deleteUserSessions(userId)
  createSession(userId, expiresAt, tokenHash(token))
  response.setHeader('Set-Cookie', setSessionCookie(token, process.env.NODE_ENV === 'production'))
}

export function clearSession(request: IncomingMessage, response: ServerResponse) {
  const token = normaliseSessionToken(parseCookies(request)[sessionCookie])
  if (token) deleteSession(tokenHash(token))
  response.setHeader('Set-Cookie', clearSessionCookie(process.env.NODE_ENV === 'production'))
}

export function currentUser(request: IncomingMessage): User | null {
  const token = normaliseSessionToken(parseCookies(request)[sessionCookie])
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
