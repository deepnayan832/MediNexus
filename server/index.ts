import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import {
  audit,
  createAppointmentForPatient,
  createHealthMetric,
  createUser,
  databaseIsReady,
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
} from './db.js'
import { clearSession, currentUser, requireRole, requireUser, sessionForUser } from './auth.js'
import { asNumber, asString, readJson, sendError, sendJson } from './http.js'

const isProduction = process.env.NODE_ENV === 'production'
const portValue = process.env.PORT ?? '8787'
if (!/^\d+$/.test(portValue) || Number(portValue) < 1 || Number(portValue) > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}
const port = Number(portValue)
const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1')

function readAllowedOrigins() {
  const configuredOrigins = process.env.MEDINEXUS_CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean)
  const origins = configuredOrigins?.length
    ? configuredOrigins
    : isProduction
      ? []
      : ['http://127.0.0.1:5173', 'http://localhost:5173']

  const validatedOrigins = origins.map((origin) => {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      throw new Error('MEDINEXUS_CORS_ORIGIN must contain comma-separated origin URLs.')
    }
    const localDevelopmentOrigin = !isProduction && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
    if (parsed.origin !== origin || (parsed.protocol !== 'https:' && !(localDevelopmentOrigin && parsed.protocol === 'http:'))) {
      throw new Error('MEDINEXUS_CORS_ORIGIN entries must be HTTPS origins (HTTP is allowed only for local development).')
    }
    return origin
  })

  if (isProduction && validatedOrigins.length === 0) {
    throw new Error('Set MEDINEXUS_CORS_ORIGIN to the HTTPS frontend origin before starting in production.')
  }
  return new Set(validatedOrigins)
}

const allowedOrigins = readAllowedOrigins()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const metricTypes = new Set(['steps', 'heart_rate', 'sleep', 'hydration', 'blood_oxygen', 'weight'])

function setCorsHeaders(response: ServerResponse, origin: string) {
  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Vary', 'Origin')
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin
  response.setHeader('Vary', 'Origin')
  if (origin && !allowedOrigins.has(origin)) {
    sendError(response, 403, 'This origin is not allowed to access the MediNexus API.', 'CORS_ORIGIN_NOT_ALLOWED')
    return
  }
  if (origin) setCorsHeaders(response, origin)

  if (request.method === 'OPTIONS') {
    if (!origin) {
      sendError(response, 403, 'A valid origin is required for this preflight request.', 'CORS_ORIGIN_NOT_ALLOWED')
      return
    }
    response.writeHead(204)
    response.end()
    return
  }

  const url = new URL(request.url ?? '/', 'http://medinexus.local')
  const path = url.pathname

  if (request.method === 'GET' && path === '/api/health') {
    let ready = false
    try {
      ready = databaseIsReady()
    } catch {
      // Return an opaque degraded status. Database details belong in server logs, not the public response.
    }
    sendJson(response, ready ? 200 : 503, {
      service: 'medinexus-api',
      status: ready ? 'ok' : 'degraded',
      database: ready ? 'connected' : 'unavailable',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    })
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

  sendError(response, 404, 'The requested resource was not found.', 'NOT_FOUND')
}

const server = createServer((request, response) => {
  handle(request, response).catch((error: unknown) => {
    console.error('MediNexus request failed', {
      method: request.method ?? 'UNKNOWN',
      errorType: error instanceof Error ? error.name : 'UnknownError',
    })
    if (response.headersSent) {
      response.destroy()
      return
    }
    sendError(response, 500, 'An unexpected server error occurred.', 'INTERNAL_ERROR')
  })
})

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error('MediNexus API failed to start', { errorCode: error.code ?? 'UNKNOWN' })
  process.exitCode = 1
})

server.listen(port, host, () => {
  console.log(`MediNexus API listening on ${host}:${port}`)
})

