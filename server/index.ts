import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import {
  audit,
  createAppointmentForPatient,
  createHealthMetric,
  createUser,
  getDashboardSummary,
  getUserByEmail,
  listAppointments,
  listHealthMetrics,
  listNotifications,
  listPatients,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeEmail,
  verifyPassword,
} from './db'
import { clearSession, currentUser, requireRole, requireUser, sessionForUser } from './auth'
import { asNumber, asString, readJson, sendError, sendJson } from './http'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.MEDINEXUS_HOST ?? (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const isProduction = process.env.NODE_ENV === 'production'
const publicOriginInput = (process.env.MEDINEXUS_PUBLIC_ORIGIN ?? '').trim()
let publicOrigin: string | undefined

if (publicOriginInput) {
  let parsed: URL
  try { parsed = new URL(publicOriginInput) }
  catch { throw new Error('MEDINEXUS_PUBLIC_ORIGIN must be a valid absolute origin.') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('MEDINEXUS_PUBLIC_ORIGIN must be an HTTPS origin with no path, query, or fragment.')
  }
  publicOrigin = parsed.origin
}
if (isProduction && !publicOrigin) {
  throw new Error('Production requires MEDINEXUS_PUBLIC_ORIGIN, e.g. https://medinexus.example.com.')
}

const configuredCorsOrigins = (process.env.MEDINEXUS_CORS_ORIGINS ?? '').split(',').map((value) => value.trim()).filter(Boolean)
const developmentOrigins = !isProduction ? (process.env.MEDINEXUS_CORS_ORIGIN ?? 'http://127.0.0.1:5173').split(',').map((value) => value.trim()).filter(Boolean) : []
const allowedOrigins = new Set([...(publicOrigin ? [publicOrigin] : []), ...configuredCorsOrigins, ...developmentOrigins])
const staticRoot = resolve(process.env.MEDINEXUS_STATIC_DIR ?? 'dist')
const staticIndexPath = resolve(staticRoot, 'index.html')
const hasBuiltFrontend = existsSync(staticIndexPath)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const metricTypes = new Set(['steps', 'heart_rate', 'sleep', 'hydration', 'blood_oxygen', 'weight'])

function isAllowedOrigin(origin: string | undefined): boolean {
  return Boolean(origin && allowedOrigins.has(origin))
}

function corsHeaders(request: IncomingMessage): Record<string, string> {
  const origin = request.headers.origin
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (!isAllowedOrigin(origin)) return headers
  headers['Access-Control-Allow-Origin'] = origin!
  headers['Access-Control-Allow-Credentials'] = 'true'
  headers['Access-Control-Allow-Headers'] = 'Content-Type'
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
  return headers
}

function setSecurityHeaders(response: ServerResponse) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

async function serveFrontend(request: IncomingMessage, response: ServerResponse, pathname: string): Promise<boolean> {
  if (!hasBuiltFrontend || (request.method !== 'GET' && request.method !== 'HEAD')) return false
  let decodedPath: string
  try { decodedPath = decodeURIComponent(pathname) }
  catch { sendError(response, 400, 'Invalid URL path.', 'BAD_REQUEST'); return true }
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '')
  const candidate = resolve(staticRoot, relativePath)
  if (candidate !== staticRoot && !candidate.startsWith(staticRoot + sep)) {
    sendError(response, 404, 'The requested resource was not found.', 'NOT_FOUND'); return true
  }
  let filePath = candidate
  try { const info = await stat(filePath); if (!info.isFile()) throw new Error('not_a_file') }
  catch {
    if (extname(decodedPath)) { sendError(response, 404, 'The requested resource was not found.', 'NOT_FOUND'); return true }
    filePath = staticIndexPath
  }
  const extension = extname(filePath).toLowerCase()
  const contentType: Record<string, string> = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.json':'application/json; charset=utf-8' }
  response.writeHead(200, { 'Content-Type': contentType[extension] ?? 'application/octet-stream', 'Cache-Control': filePath === staticIndexPath ? 'no-cache' : 'public, max-age=86400' })
  if (request.method === 'HEAD') { response.end(); return true }
  response.end(await readFile(filePath))
  return true
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  setSecurityHeaders(response)
  Object.entries(corsHeaders(request)).forEach(([key, value]) => response.setHeader(key, value))

  const url = new URL(request.url ?? '/', 'http://' + (request.headers.host ?? 'localhost'))
  const path = url.pathname
  if (path.startsWith('/api/')) response.setHeader('Cache-Control', 'no-store')

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request.headers.origin)) {
      sendError(response, 403, 'This origin is not allowed.', 'ORIGIN_REJECTED')
      return
    }
    response.writeHead(204)
    response.end()
    return
  }

  if (path.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method ?? '') && !isAllowedOrigin(request.headers.origin)) {
    sendError(response, 403, 'Cross-origin or origin-less API writes are not allowed.', 'ORIGIN_REJECTED')
    return
  }
  if (request.method === 'GET' && path === '/api/health') {
    sendJson(response, 200, { service: 'medinexus-api', status: 'ok', database: 'sqlite', timestamp: new Date().toISOString() })
    return
  }

  if (request.method === 'POST' && path === '/api/auth/register') {
    try {
      const body = await readJson(request)
      const email = normalizeEmail(asString(body.email, 160))
      const name = asString(body.name, 120)
      const password = asString(body.password, 200)
      if (!emailPattern.test(email) || name.length < 2 || password.length < 12) {
        sendError(response, 422, 'Provide a valid name, email, and password of at least 12 characters.', 'VALIDATION_ERROR')
        return
      }
      if (getUserByEmail(email)) {
        sendError(response, 409, 'An account already exists for this email.', 'EMAIL_IN_USE')
        return
      }
      const user = createUser({ email, name, password })
      sessionForUser(response, user.id)
      audit(user.id, 'account.created', 'user', user.id)
      sendJson(response, 201, { user })
    } catch (error) {
      sendError(response, 400, error instanceof Error && error.message === 'payload_too_large' ? 'Request body is too large.' : 'The registration payload is invalid.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'POST' && path === '/api/auth/login') {
    try {
      const body = await readJson(request)
      const email = normalizeEmail(asString(body.email, 160))
      const password = asString(body.password, 200)
      const stored = getUserByEmail(email)
      if (!stored || !verifyPassword(password, stored.passwordHash, stored.passwordSalt)) {
        sendError(response, 401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS')
        return
      }
      sessionForUser(response, stored.id)
      audit(stored.id, 'auth.login', 'session')
      sendJson(response, 200, { user: { id: stored.id, email: stored.email, name: stored.name, role: stored.role, createdAt: stored.createdAt } })
    } catch {
      sendError(response, 400, 'The login payload is invalid.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'POST' && path === '/api/auth/logout') {
    const user = currentUser(request)
    clearSession(request, response)
    if (user) audit(user.id, 'auth.logout', 'session')
    sendJson(response, 200, { ok: true })
    return
  }

  if (request.method === 'GET' && path === '/api/auth/me') {
    const user = currentUser(request)
    if (!user) {
      sendError(response, 401, 'No active session.', 'UNAUTHENTICATED')
      return
    }
    sendJson(response, 200, { user })
    return
  }

  if (request.method === 'GET' && path === '/api/auth/session') {
    sendJson(response, 200, { user: currentUser(request) })
    return
  }

  const user = requireUser(request, response)
  if (!user) return

  if (request.method === 'GET' && path === '/api/dashboard') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff', 'Patient'])) return
    sendJson(response, 200, { user, summary: getDashboardSummary(user), appointments: listAppointments(user) })
    return
  }

  if (request.method === 'GET' && path === '/api/patients') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    sendJson(response, 200, { patients: listPatients(asString(url.searchParams.get('search'), 120)) })
    return
  }

  if (request.method === 'GET' && path === '/api/appointments') {
    sendJson(response, 200, { appointments: listAppointments(user) })
    return
  }

  if (request.method === 'POST' && path === '/api/appointments') {
    if (!requireRole(user, response, ['Patient'])) return
    try {
      const body = await readJson(request)
      const department = asString(body.department, 80)
      const appointmentAt = asString(body.appointmentAt, 40)
      if (department.length < 2 || Number.isNaN(Date.parse(appointmentAt))) {
        sendError(response, 422, 'A department and valid appointment time are required.', 'VALIDATION_ERROR')
        return
      }
      const appointment = createAppointmentForPatient({ userId: user.id, department, appointmentAt: new Date(appointmentAt).toISOString() })
      if (!appointment) {
        sendError(response, 409, 'A patient profile is required before booking care.', 'PATIENT_PROFILE_REQUIRED')
        return
      }
      audit(user.id, 'appointment.created', 'appointment', String(appointment.id))
      sendJson(response, 201, { appointment })
    } catch (error) {
      sendError(response, 400, error instanceof Error && error.message === 'payload_too_large' ? 'Request body is too large.' : 'The appointment payload is invalid.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'GET' && path === '/api/health-metrics') {
    if (!requireRole(user, response, ['Patient'])) return
    sendJson(response, 200, { metrics: listHealthMetrics(user.id) })
    return
  }

  if (request.method === 'POST' && path === '/api/health-metrics') {
    if (!requireRole(user, response, ['Patient'])) return
    try {
      const body = await readJson(request)
      const metricType = asString(body.metricType, 40)
      const value = asNumber(body.value)
      const unit = asString(body.unit, 20)
      const goalValue = body.goalValue === undefined ? undefined : asNumber(body.goalValue)
      const recordedAt = asString(body.recordedAt, 40) || new Date().toISOString()
      if (!metricTypes.has(metricType) || !unit || !Number.isFinite(value) || value < 0 || (goalValue !== undefined && !Number.isFinite(goalValue)) || Number.isNaN(Date.parse(recordedAt))) {
        sendError(response, 422, 'Metric type, value, unit, and timestamp must be valid.', 'VALIDATION_ERROR')
        return
      }
      const metric = createHealthMetric({ userId: user.id, metricType, value, unit, goalValue, recordedAt: new Date(recordedAt).toISOString() })
      audit(user.id, 'health_metric.created', 'health_metric', String(metric.id))
      sendJson(response, 201, { metric })
    } catch (error) {
      sendError(response, 400, error instanceof Error && error.message === 'payload_too_large' ? 'Request body is too large.' : 'The metric payload is invalid.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'GET' && path === '/api/notifications') {
    sendJson(response, 200, { notifications: listNotifications(user.id) })
    return
  }

  if (request.method === 'POST' && path === '/api/notifications/read-all') {
    markAllNotificationsRead(user.id)
    audit(user.id, 'notifications.read_all', 'notification')
    sendJson(response, 200, { ok: true })
    return
  }

  const notificationMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/)
  if (request.method === 'POST' && notificationMatch) {
    markNotificationRead(user.id, notificationMatch[1])
    audit(user.id, 'notification.read', 'notification', notificationMatch[1])
    sendJson(response, 200, { ok: true })
    return
  }

  if (path.startsWith('/api/')) {
    sendError(response, 404, 'The requested resource was not found.', 'NOT_FOUND')
    return
  }
  if (await serveFrontend(request, response, path)) return
  sendError(response, 404, 'The requested resource was not found.', 'NOT_FOUND')
}

const server = createServer((request, response) => {
  handle(request, response).catch(() => sendError(response, 500, 'An unexpected server error occurred.', 'INTERNAL_ERROR'))
})

server.listen(port, host, () => {
  console.log('MediNexus server listening on http://' + host + ':' + port)
})
