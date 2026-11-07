import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { existsSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import {
  audit,
  changeUserPassword,
  createAdmission,
  createAppointment,
  createAppointmentForPatient,
  createBed,
  createClinicalNote,
  createEmergencyCase,
  createHealthMetric,
  createInsuranceClaim,
  createInvoice,
  createLabOrder,
  createMedication,
  createPatient,
  createPrescription,
  createUser,
  dischargeAdmission,
  dispensePrescription,
  exportTableToCsv,
  getAppointmentById,
  getBedById,
  getDashboardSummary,
  getEmergencyCaseById,
  getInvoiceById,
  getLabOrderById,
  getMedicationById,
  getPatientById,
  getStoredUserById,
  getUserByEmail,
  listAdmissions,
  listAppointments,
  listBeds,
  listClinicalNotes,
  listEmergencyCases,
  listHealthMetrics,
  listInsuranceClaims,
  listInvoices,
  listLabOrders,
  listMedications,
  listNotifications,
  listPatients,
  listPrescriptions,
  markAllNotificationsRead,
  markNotificationRead,
  normalizeEmail,
  payInvoice,
  updateAppointment,
  updateBedStatus,
  updateEmergencyCase,
  updateLabOrder,
  updateMedicationStock,
  updatePatient,
  updateUserProfile,
  verifyPassword,
} from './db'
import { clearSession, currentUser, requireRole, requireUser, sessionForUser } from './auth'
import { asNumber, asString, readJson, sendError, sendJson } from './http'
import { SlidingWindowLimiter } from './rate-limit'

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
const developmentOrigins = !isProduction
  ? [
      ...(process.env.MEDINEXUS_CORS_ORIGIN ?? 'http://127.0.0.1:5173').split(',').map((v) => v.trim()).filter(Boolean),
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:8787',
      'http://127.0.0.1:8787',
    ]
  : []
const allowedOrigins = new Set([...(publicOrigin ? [publicOrigin] : []), ...configuredCorsOrigins, ...developmentOrigins])
const staticRoot = resolve(process.env.MEDINEXUS_STATIC_DIR ?? 'dist')
const staticIndexPath = resolve(staticRoot, 'index.html')
const hasBuiltFrontend = existsSync(staticIndexPath)
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const metricTypes = new Set(['steps', 'heart_rate', 'sleep', 'hydration', 'blood_oxygen', 'weight'])
const trustProxy = process.env.MEDINEXUS_TRUST_PROXY === 'true'
const loginLimiter = new SlidingWindowLimiter()
const registrationLimiter = new SlidingWindowLimiter()

function configuredLimit(name: string, fallback: number, maximum: number): number {
  const raw = process.env[name]
  if (!raw?.trim()) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`)
  }
  return value
}

const authAttemptsPerMinute = configuredLimit('MEDINEXUS_AUTH_ATTEMPTS_PER_MINUTE', 10, 1000)
const registrationsPerHour = configuredLimit('MEDINEXUS_REGISTRATIONS_PER_HOUR', 5, 1000)

function clientAddress(request: IncomingMessage): string {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const address = forwarded.split(',')[0]?.trim()
      if (address) return address
    }
  }
  return request.socket.remoteAddress || 'unknown'
}

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
  headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  return headers
}

function setSecurityHeaders(response: ServerResponse) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' http: https:;")
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
  const contentType: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.json': 'application/json; charset=utf-8',
  }
  response.writeHead(200, {
    'Content-Type': contentType[extension] ?? 'application/octet-stream',
    'Cache-Control': filePath === staticIndexPath ? 'no-cache' : 'public, max-age=86400',
  })
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

  /* -------------------------------------------------------------------------
     AUTHENTICATION & SESSIONS
  ------------------------------------------------------------------------- */

  if (request.method === 'POST' && path === '/api/auth/register') {
    if (!registrationLimiter.allow(clientAddress(request), registrationsPerHour, 60 * 60 * 1000)) {
      sendJson(response, 429, { error: { code: 'RATE_LIMITED', message: 'Too many registration attempts. Try again later.' } }, { 'Retry-After': '3600' })
      return
    }
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
    if (!loginLimiter.allow(clientAddress(request), authAttemptsPerMinute, 60 * 1000)) {
      sendJson(response, 429, { error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Try again in a minute.' } }, { 'Retry-After': '60' })
      return
    }
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

  // All endpoints below this line require an authenticated session
  const user = requireUser(request, response)
  if (!user) return

  /* -------------------------------------------------------------------------
     USER PROFILE & PASSWORD
  ------------------------------------------------------------------------- */

  if (request.method === 'PATCH' && path === '/api/auth/profile') {
    try {
      const body = await readJson(request)
      const name = asString(body.name, 120)
      const email = normalizeEmail(asString(body.email, 160))
      if (!emailPattern.test(email) || name.length < 2) {
        sendError(response, 422, 'Valid name and email are required.', 'VALIDATION_ERROR')
        return
      }
      const existing = getUserByEmail(email)
      if (existing && existing.id !== user.id) {
        sendError(response, 409, 'Email address is already in use by another account.', 'EMAIL_IN_USE')
        return
      }
      const updated = updateUserProfile(user.id, name, email)
      audit(user.id, 'user.updated_profile', 'user', user.id)
      sendJson(response, 200, { user: updated })
    } catch {
      sendError(response, 400, 'Invalid profile update payload.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'POST' && path === '/api/auth/change-password') {
    try {
      const body = await readJson(request)
      const currentPassword = asString(body.currentPassword, 200)
      const newPassword = asString(body.newPassword, 200)
      if (newPassword.length < 12) {
        sendError(response, 422, 'New password must be at least 12 characters.', 'VALIDATION_ERROR')
        return
      }
      const stored = getStoredUserById(user.id)
      if (!stored || !verifyPassword(currentPassword, stored.passwordHash, stored.passwordSalt)) {
        sendError(response, 401, 'Current password is incorrect.', 'INVALID_CREDENTIALS')
        return
      }
      changeUserPassword(user.id, newPassword)
      audit(user.id, 'user.changed_password', 'user', user.id)
      sendJson(response, 200, { ok: true, message: 'Password successfully changed.' })
    } catch {
      sendError(response, 400, 'Invalid password change payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     DASHBOARD & SUMMARY
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/dashboard') {
    sendJson(response, 200, { user, summary: getDashboardSummary(user), appointments: listAppointments(user) })
    return
  }

  /* -------------------------------------------------------------------------
     PATIENTS MANAGEMENT
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/patients') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    const search = asString(url.searchParams.get('search'), 120)
    const department = asString(url.searchParams.get('department'), 80)
    const status = asString(url.searchParams.get('status'), 50)
    sendJson(response, 200, { patients: listPatients(search, department, status) })
    return
  }

  const patientMatch = path.match(/^\/api\/patients\/([^/]+)$/)
  if (request.method === 'GET' && patientMatch) {
    const patientId = patientMatch[1]
    const patient = getPatientById(patientId)
    if (!patient) {
      sendError(response, 404, 'Patient not found.', 'NOT_FOUND')
      return
    }
    if (user.role === 'Patient' && patient.userId !== user.id) {
      sendError(response, 403, 'You are not permitted to view this patient record.', 'FORBIDDEN')
      return
    }
    sendJson(response, 200, { patient })
    return
  }

  if (request.method === 'POST' && path === '/api/patients') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    try {
      const body = await readJson(request)
      const name = asString(body.name, 120)
      const department = asString(body.department, 80) || 'General Medicine'
      const status = asString(body.status, 50) || 'New intake'
      const dob = asString(body.dob, 20) || undefined
      const gender = asString(body.gender, 20) || undefined
      const phone = asString(body.phone, 30) || undefined
      const bloodGroup = asString(body.bloodGroup, 10) || undefined
      const allergies = asString(body.allergies, 100) || undefined
      if (name.length < 2) {
        sendError(response, 422, 'Patient name is required.', 'VALIDATION_ERROR')
        return
      }
      const patient = createPatient({ name, department, status, dob, gender, phone, bloodGroup, allergies })
      audit(user.id, 'patient.created', 'patient', String(patient?.id))
      sendJson(response, 201, { patient })
    } catch {
      sendError(response, 400, 'Invalid patient creation payload.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'PATCH' && patientMatch) {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    try {
      const patientId = patientMatch[1]
      const body = await readJson(request)
      const updated = updatePatient(patientId, {
        name: body.name !== undefined ? asString(body.name, 120) : undefined,
        department: body.department !== undefined ? asString(body.department, 80) : undefined,
        status: body.status !== undefined ? asString(body.status, 50) : undefined,
        dob: body.dob !== undefined ? asString(body.dob, 20) : undefined,
        gender: body.gender !== undefined ? asString(body.gender, 20) : undefined,
        phone: body.phone !== undefined ? asString(body.phone, 30) : undefined,
        bloodGroup: body.bloodGroup !== undefined ? asString(body.bloodGroup, 10) : undefined,
        allergies: body.allergies !== undefined ? asString(body.allergies, 100) : undefined,
      })
      if (!updated) {
        sendError(response, 404, 'Patient not found.', 'NOT_FOUND')
        return
      }
      audit(user.id, 'patient.updated', 'patient', patientId)
      sendJson(response, 200, { patient: updated })
    } catch {
      sendError(response, 400, 'Invalid patient update payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     APPOINTMENTS
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/appointments') {
    const department = asString(url.searchParams.get('department'), 80)
    const status = asString(url.searchParams.get('status'), 50)
    const date = asString(url.searchParams.get('date'), 30)
    sendJson(response, 200, { appointments: listAppointments(user, { department, status, date }) })
    return
  }

  const appointmentMatch = path.match(/^\/api\/appointments\/([^/]+)$/)
  if (request.method === 'GET' && appointmentMatch) {
    const appointmentId = appointmentMatch[1]
    const appointment = getAppointmentById(appointmentId)
    if (!appointment) {
      sendError(response, 404, 'Appointment not found.', 'NOT_FOUND')
      return
    }
    if (user.role === 'Patient') {
      const patient = getPatientById(String(appointment.patientId))
      if (!patient || patient.userId !== user.id) {
        sendError(response, 403, 'You are not permitted to view this appointment.', 'FORBIDDEN')
        return
      }
    }
    sendJson(response, 200, { appointment })
    return
  }

  if (request.method === 'POST' && path === '/api/appointments') {
    try {
      const body = await readJson(request)
      const department = asString(body.department, 80)
      const appointmentAt = asString(body.appointmentAt, 40)
      const clinicianName = asString(body.clinicianName, 120)
      const notes = asString(body.notes, 500)

      if (department.length < 2 || Number.isNaN(Date.parse(appointmentAt))) {
        sendError(response, 422, 'A department and valid appointment time are required.', 'VALIDATION_ERROR')
        return
      }

      if (user.role === 'Patient') {
        const appointment = createAppointmentForPatient({
          userId: user.id,
          department,
          appointmentAt: new Date(appointmentAt).toISOString(),
          clinicianName,
          notes,
        })
        if (!appointment) {
          sendError(response, 409, 'A patient profile is required before booking care.', 'PATIENT_PROFILE_REQUIRED')
          return
        }
        audit(user.id, 'appointment.created', 'appointment', String(appointment.id))
        sendJson(response, 201, { appointment })
        return
      }

      // Admin, Doctor, Staff booking for a patient
      const patientId = asString(body.patientId, 50)
      if (!patientId) {
        sendError(response, 422, 'patientId is required for clinician booking.', 'VALIDATION_ERROR')
        return
      }
      const room = asString(body.room, 40) || 'Room 301'
      const status = asString(body.status, 40) || 'Confirmed'
      const appointment = createAppointment({
        patientId,
        clinicianName: clinicianName || user.name,
        department,
        appointmentAt: new Date(appointmentAt).toISOString(),
        room,
        status,
        notes,
        createdByUserId: user.id,
      })
      audit(user.id, 'appointment.created', 'appointment', String(appointment?.id))
      sendJson(response, 201, { appointment })
    } catch (error) {
      sendError(response, 400, error instanceof Error && error.message === 'payload_too_large' ? 'Request body is too large.' : 'The appointment payload is invalid.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'PATCH' && appointmentMatch) {
    try {
      const appointmentId = appointmentMatch[1]
      const current = getAppointmentById(appointmentId)
      if (!current) {
        sendError(response, 404, 'Appointment not found.', 'NOT_FOUND')
        return
      }
      const body = await readJson(request)
      const status = asString(body.status, 40) || undefined
      const room = asString(body.room, 40) || undefined
      const clinicianName = asString(body.clinicianName, 120) || undefined
      const department = asString(body.department, 80) || undefined
      const notes = asString(body.notes, 500) || undefined
      const appointmentAt = body.appointmentAt ? new Date(asString(body.appointmentAt, 40)).toISOString() : undefined

      // Patients may only cancel appointments that belong to their own patient profile.
      if (user.role === 'Patient') {
        const patient = getPatientById(String(current.patientId))
        if (!patient || patient.userId !== user.id) {
          sendError(response, 403, 'You are not permitted to modify this appointment.', 'FORBIDDEN')
          return
        }
        if (status !== 'Cancelled') {
          sendError(response, 403, 'Patients may only cancel appointments directly.', 'FORBIDDEN')
          return
        }
        const updated = updateAppointment(appointmentId, { status: 'Cancelled' })
        audit(user.id, 'appointment.cancelled', 'appointment', appointmentId)
        sendJson(response, 200, { appointment: updated })
        return
      }

      const updated = updateAppointment(appointmentId, { status, room, clinicianName, department, notes, appointmentAt })
      audit(user.id, 'appointment.updated', 'appointment', appointmentId)
      sendJson(response, 200, { appointment: updated })
    } catch {
      sendError(response, 400, 'Invalid appointment update payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     INPATIENT CARE / BEDS & ADMISSIONS
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/beds') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    const ward = asString(url.searchParams.get('ward'), 50)
    const status = asString(url.searchParams.get('status'), 50)
    sendJson(response, 200, { beds: listBeds(ward, status) })
    return
  }

  if (request.method === 'POST' && path === '/api/beds') {
    if (!requireRole(user, response, ['Admin', 'Staff'])) return
    try {
      const body = await readJson(request)
      const ward = asString(body.ward, 50)
      const roomNumber = asString(body.roomNumber, 20)
      const bedNumber = asString(body.bedNumber, 20)
      const bedType = asString(body.bedType, 30) || 'Standard'
      if (!ward || !roomNumber || !bedNumber) {
        sendError(response, 422, 'Ward, room number, and bed number are required.', 'VALIDATION_ERROR')
        return
      }
      const bed = createBed({ ward, roomNumber, bedNumber, bedType })
      audit(user.id, 'bed.created', 'bed', String(bed?.id))
      sendJson(response, 201, { bed })
    } catch {
      sendError(response, 400, 'Invalid bed payload.', 'BAD_REQUEST')
    }
    return
  }

  const bedMatch = path.match(/^\/api\/beds\/([^/]+)$/)
  if (request.method === 'PATCH' && bedMatch) {
    if (!requireRole(user, response, ['Admin', 'Staff'])) return
    try {
      const bedId = bedMatch[1]
      const body = await readJson(request)
      const status = asString(body.status, 20) as 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance'
      if (!['Available', 'Occupied', 'Cleaning', 'Maintenance'].includes(status)) {
        sendError(response, 422, 'Invalid bed status.', 'VALIDATION_ERROR')
        return
      }
      const bed = updateBedStatus(bedId, status)
      audit(user.id, 'bed.updated_status', 'bed', bedId)
      sendJson(response, 200, { bed })
    } catch {
      sendError(response, 400, 'Invalid bed status update.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'GET' && path === '/api/admissions') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    const status = asString(url.searchParams.get('status'), 30)
    sendJson(response, 200, { admissions: listAdmissions(status) })
    return
  }

  if (request.method === 'POST' && path === '/api/admissions') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    try {
      const body = await readJson(request)
      const patientId = asString(body.patientId, 50)
      const bedId = asString(body.bedId, 50)
      const admittingDoctor = asString(body.admittingDoctor, 120) || user.name
      const diagnosis = asString(body.diagnosis, 200)
      if (!patientId || !bedId || !diagnosis) {
        sendError(response, 422, 'Patient, bed, and diagnosis are required.', 'VALIDATION_ERROR')
        return
      }
      const admission = createAdmission({ patientId, bedId, admittingDoctor, diagnosis })
      audit(user.id, 'admission.created', 'admission', String(admission?.id))
      sendJson(response, 201, { admission })
    } catch {
      sendError(response, 400, 'Invalid admission payload.', 'BAD_REQUEST')
    }
    return
  }

  const dischargeMatch = path.match(/^\/api\/admissions\/([^/]+)\/discharge$/)
  if (request.method === 'POST' && dischargeMatch) {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    const admissionId = dischargeMatch[1]
    const admission = dischargeAdmission(admissionId)
    if (!admission) {
      sendError(response, 404, 'Admission not found.', 'NOT_FOUND')
      return
    }
    audit(user.id, 'admission.discharged', 'admission', admissionId)
    sendJson(response, 200, { admission })
    return
  }

  /* -------------------------------------------------------------------------
     EMERGENCY DEPARTMENT & TRIAGE
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/emergency') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    const status = asString(url.searchParams.get('status'), 30)
    const priority = asNumber(url.searchParams.get('acuity'))
    sendJson(response, 200, { cases: listEmergencyCases(status, Number.isFinite(priority) ? priority : undefined) })
    return
  }

  if (request.method === 'POST' && path === '/api/emergency') {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    try {
      const body = await readJson(request)
      const patientName = asString(body.patientName, 120)
      const chiefComplaint = asString(body.chiefComplaint, 200)
      const assignedTeam = asString(body.assignedTeam, 50) || 'General'
      const triageAcuity = asNumber(body.triageAcuity) || 3
      const age = asNumber(body.age)
      const vitals = asString(body.vitals, 120)
      const patientId = asString(body.patientId, 50) || undefined

      if (!patientName || !chiefComplaint || triageAcuity < 1 || triageAcuity > 5) {
        sendError(response, 422, 'Patient name, valid chief complaint, and triage acuity (1-5) are required.', 'VALIDATION_ERROR')
        return
      }

      const edCase = createEmergencyCase({
        patientId,
        patientName,
        age: Number.isFinite(age) ? age : undefined,
        triageAcuity,
        chiefComplaint,
        vitals,
        assignedTeam,
      })
      audit(user.id, 'emergency.created', 'emergency_case', String(edCase?.id))
      sendJson(response, 201, { case: edCase })
    } catch {
      sendError(response, 400, 'Invalid emergency triage payload.', 'BAD_REQUEST')
    }
    return
  }

  const emergencyMatch = path.match(/^\/api\/emergency\/([^/]+)$/)
  if (request.method === 'PATCH' && emergencyMatch) {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    try {
      const caseId = emergencyMatch[1]
      const body = await readJson(request)
      const status = asString(body.status, 30) as 'Triage' | 'In Treatment' | 'Awaiting Bed' | 'Discharged' | undefined
      const assignedTeam = asString(body.assignedTeam, 50) || undefined
      const vitals = asString(body.vitals, 120) || undefined
      const chiefComplaint = asString(body.chiefComplaint, 200) || undefined
      const triageAcuity = asNumber(body.triageAcuity)
      const edCase = updateEmergencyCase(caseId, {
        status,
        assignedTeam,
        vitals,
        chiefComplaint,
        triageAcuity: Number.isFinite(triageAcuity) ? triageAcuity : undefined,
      })
      if (!edCase) {
        sendError(response, 404, 'Emergency case not found.', 'NOT_FOUND')
        return
      }
      audit(user.id, 'emergency.updated', 'emergency_case', caseId)
      sendJson(response, 200, { case: edCase })
    } catch {
      sendError(response, 400, 'Invalid emergency update payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     PHARMACY & PRESCRIPTIONS
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/medications') {
    const search = asString(url.searchParams.get('search'), 100)
    const status = asString(url.searchParams.get('status'), 30)
    sendJson(response, 200, { medications: listMedications(search, status) })
    return
  }

  if (request.method === 'POST' && path === '/api/medications') {
    if (!requireRole(user, response, ['Admin', 'Staff'])) return
    try {
      const body = await readJson(request)
      const name = asString(body.name, 120)
      const code = asString(body.code, 30)
      const category = asString(body.category, 60)
      const stockQuantity = asNumber(body.stockQuantity)
      const unit = asString(body.unit, 30) || 'units'
      const reorderLevel = asNumber(body.reorderLevel) || 50
      const unitPrice = asNumber(body.unitPrice) || 0

      if (!name || !code || !category || !Number.isFinite(stockQuantity)) {
        sendError(response, 422, 'Name, unique code, category, and valid stock quantity are required.', 'VALIDATION_ERROR')
        return
      }
      const med = createMedication({ name, code, category, stockQuantity, unit, reorderLevel, unitPrice })
      audit(user.id, 'medication.created', 'medication', String(med?.id))
      sendJson(response, 201, { medication: med })
    } catch {
      sendError(response, 400, 'Invalid medication payload.', 'BAD_REQUEST')
    }
    return
  }

  const medMatch = path.match(/^\/api\/medications\/([^/]+)$/)
  if (request.method === 'PATCH' && medMatch) {
    if (!requireRole(user, response, ['Admin', 'Staff'])) return
    try {
      const medId = medMatch[1]
      const body = await readJson(request)
      const stockQuantity = asNumber(body.stockQuantity)
      if (!Number.isFinite(stockQuantity)) {
        sendError(response, 422, 'Valid stockQuantity is required.', 'VALIDATION_ERROR')
        return
      }
      const updated = updateMedicationStock(medId, stockQuantity)
      audit(user.id, 'medication.updated_stock', 'medication', medId)
      sendJson(response, 200, { medication: updated })
    } catch {
      sendError(response, 400, 'Invalid medication update payload.', 'BAD_REQUEST')
    }
    return
  }

  if (request.method === 'GET' && path === '/api/prescriptions') {
    const patientId = asString(url.searchParams.get('patientId'), 50)
    sendJson(response, 200, { prescriptions: listPrescriptions(user, patientId) })
    return
  }

  if (request.method === 'POST' && path === '/api/prescriptions') {
    if (!requireRole(user, response, ['Doctor', 'Admin'])) return
    try {
      const body = await readJson(request)
      const patientId = asString(body.patientId, 50)
      const medicationId = asString(body.medicationId, 50)
      const medicationName = asString(body.medicationName, 120)
      const dosage = asString(body.dosage, 80)
      const frequency = asString(body.frequency, 80)
      const duration = asString(body.duration, 80)

      if (!patientId || !medicationId || !dosage || !frequency) {
        sendError(response, 422, 'Patient, medication, dosage, and frequency are required.', 'VALIDATION_ERROR')
        return
      }
      const prescription = createPrescription({
        patientId,
        doctorId: user.id,
        doctorName: user.name,
        medicationId,
        medicationName,
        dosage,
        frequency,
        duration: duration || '30 days',
      })
      audit(user.id, 'prescription.created', 'prescription', String(prescription?.id))
      sendJson(response, 201, { prescription })
    } catch {
      sendError(response, 400, 'Invalid prescription payload.', 'BAD_REQUEST')
    }
    return
  }

  const rxDispenseMatch = path.match(/^\/api\/prescriptions\/([^/]+)\/dispense$/)
  if (request.method === 'PATCH' && rxDispenseMatch) {
    if (!requireRole(user, response, ['Admin', 'Staff', 'Doctor'])) return
    const rxId = rxDispenseMatch[1]
    const prescription = dispensePrescription(rxId)
    audit(user.id, 'prescription.dispensed', 'prescription', rxId)
    sendJson(response, 200, { prescription })
    return
  }

  /* -------------------------------------------------------------------------
     LABS & DIAGNOSTICS
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/labs') {
    const patientId = asString(url.searchParams.get('patientId'), 50)
    const status = asString(url.searchParams.get('status'), 30)
    sendJson(response, 200, { labs: listLabOrders(user, patientId, status) })
    return
  }

  if (request.method === 'POST' && path === '/api/labs') {
    if (!requireRole(user, response, ['Doctor', 'Admin', 'Staff'])) return
    try {
      const body = await readJson(request)
      const patientId = asString(body.patientId, 50)
      const patientName = asString(body.patientName, 120)
      const testType = asString(body.testType, 80)
      const priority = (asString(body.priority, 20) || 'Routine') as 'Routine' | 'Urgent' | 'Stat'
      const resultSummary = asString(body.resultSummary, 200)

      if (!patientId || !patientName || !testType) {
        sendError(response, 422, 'Patient and test type are required.', 'VALIDATION_ERROR')
        return
      }
      const lab = createLabOrder({
        patientId,
        patientName,
        orderedByName: user.name,
        testType,
        priority,
        resultSummary,
      })
      audit(user.id, 'lab_order.created', 'lab_order', String(lab?.id))
      sendJson(response, 201, { lab })
    } catch {
      sendError(response, 400, 'Invalid lab order payload.', 'BAD_REQUEST')
    }
    return
  }

  const labMatch = path.match(/^\/api\/labs\/([^/]+)$/)
  if (request.method === 'PATCH' && labMatch) {
    if (!requireRole(user, response, ['Doctor', 'Admin', 'Staff'])) return
    try {
      const labId = labMatch[1]
      const body = await readJson(request)
      const status = asString(body.status, 30) as 'Ordered' | 'In Progress' | 'Completed' | 'Cancelled' | undefined
      const resultSummary = asString(body.resultSummary, 500) || undefined
      const normalRange = asString(body.normalRange, 100) || undefined
      const interpretation = asString(body.interpretation, 50) || undefined

      const lab = updateLabOrder(labId, { status, resultSummary, normalRange, interpretation })
      if (!lab) {
        sendError(response, 404, 'Lab order not found.', 'NOT_FOUND')
        return
      }
      audit(user.id, 'lab_order.updated', 'lab_order', labId)
      sendJson(response, 200, { lab })
    } catch {
      sendError(response, 400, 'Invalid lab update payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     BILLING & INVOICES & INSURANCE
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/billing') {
    const patientId = asString(url.searchParams.get('patientId'), 50)
    const status = asString(url.searchParams.get('status'), 30)
    sendJson(response, 200, { invoices: listInvoices(user, patientId, status) })
    return
  }

  if (request.method === 'POST' && path === '/api/billing') {
    if (!requireRole(user, response, ['Admin', 'Staff'])) return
    try {
      const body = await readJson(request)
      const patientId = asString(body.patientId, 50)
      const patientName = asString(body.patientName, 120)
      const description = asString(body.description, 200)
      const amount = asNumber(body.amount)
      const insuranceCoverage = asNumber(body.insuranceCoverage) || 0
      const dueDate = asString(body.dueDate, 30) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      if (!patientId || !patientName || !description || !Number.isFinite(amount) || amount <= 0) {
        sendError(response, 422, 'Patient, description, and positive amount are required.', 'VALIDATION_ERROR')
        return
      }
      const invoice = createInvoice({ patientId, patientName, description, amount, insuranceCoverage, dueDate })
      audit(user.id, 'invoice.created', 'billing_invoice', String(invoice?.id))
      sendJson(response, 201, { invoice })
    } catch {
      sendError(response, 400, 'Invalid billing invoice payload.', 'BAD_REQUEST')
    }
    return
  }

  const payMatch = path.match(/^\/api\/billing\/([^/]+)\/pay$/)
  if (request.method === 'POST' && payMatch) {
    const invoiceId = payMatch[1]
    const invoice = getInvoiceById(invoiceId)
    if (!invoice) {
      sendError(response, 404, 'Invoice not found.', 'NOT_FOUND')
      return
    }
    if (user.role === 'Patient') {
      const patient = getPatientById(String(invoice.patientId))
      if (!patient || patient.userId !== user.id) {
        sendError(response, 403, 'You are not permitted to pay this invoice.', 'FORBIDDEN')
        return
      }
    }
    const updated = payInvoice(invoiceId)
    audit(user.id, 'invoice.paid', 'billing_invoice', invoiceId)
    sendJson(response, 200, { invoice: updated })
    return
  }

  if (request.method === 'GET' && path === '/api/insurance') {
    sendJson(response, 200, { claims: listInsuranceClaims(user) })
    return
  }

  if (request.method === 'POST' && path === '/api/insurance') {
    if (!requireRole(user, response, ['Admin', 'Staff'])) return
    try {
      const body = await readJson(request)
      const invoiceId = asString(body.invoiceId, 50)
      const patientId = asString(body.patientId, 50)
      const providerName = asString(body.providerName, 100)
      const policyNumber = asString(body.policyNumber, 50)
      const claimAmount = asNumber(body.claimAmount)

      if (!invoiceId || !patientId || !providerName || !policyNumber ||
          !Number.isFinite(claimAmount) || claimAmount <= 0) {
        sendError(response, 422, 'Invoice, patient, insurance provider, policy, and a positive claim amount are required.', 'VALIDATION_ERROR')
        return
      }

      const invoice = getInvoiceById(invoiceId)
      if (!invoice) {
        sendError(response, 404, 'Invoice not found.', 'NOT_FOUND')
        return
      }
      const patient = getPatientById(patientId)
      if (!patient) {
        sendError(response, 404, 'Patient not found.', 'NOT_FOUND')
        return
      }
      if (String(invoice.patientId) !== patientId) {
        sendError(response, 422, 'The invoice does not belong to the specified patient.', 'PATIENT_INVOICE_MISMATCH')
        return
      }
      if (claimAmount > Number(invoice.amount)) {
        sendError(response, 422, 'Claim amount cannot exceed the invoice total.', 'VALIDATION_ERROR')
        return
      }

      const claim = createInsuranceClaim({ invoiceId, patientId, providerName, policyNumber, claimAmount })
      audit(user.id, 'insurance_claim.submitted', 'insurance_claim', String(claim?.id))
      sendJson(response, 201, { claim })
    } catch {
      sendError(response, 400, 'Invalid insurance claim payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     CLINICAL NOTES
  ------------------------------------------------------------------------- */

  if (request.method === 'GET' && path === '/api/clinical-notes') {
    const patientId = asString(url.searchParams.get('patientId'), 50)
    if (!patientId) {
      sendError(response, 422, 'patientId query parameter is required.', 'VALIDATION_ERROR')
      return
    }
    sendJson(response, 200, { notes: listClinicalNotes(patientId, user) })
    return
  }

  if (request.method === 'POST' && path === '/api/clinical-notes') {
    if (!requireRole(user, response, ['Doctor', 'Admin'])) return
    try {
      const body = await readJson(request)
      const patientId = asString(body.patientId, 50)
      const noteType = asString(body.noteType, 50) || 'Progress Note'
      const subjective = asString(body.subjective, 1000)
      const objective = asString(body.objective, 1000)
      const assessment = asString(body.assessment, 1000)
      const plan = asString(body.plan, 1000)

      if (!patientId || !assessment || !plan) {
        sendError(response, 422, 'Patient, clinical assessment, and care plan are required.', 'VALIDATION_ERROR')
        return
      }
      const note = createClinicalNote({
        patientId,
        authorId: user.id,
        authorName: user.name,
        noteType,
        subjective,
        objective,
        assessment,
        plan,
      })
      audit(user.id, 'clinical_note.created', 'clinical_note', String(note?.id))
      sendJson(response, 201, { note })
    } catch {
      sendError(response, 400, 'Invalid clinical note payload.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     DATA EXPORT (CSV)
  ------------------------------------------------------------------------- */

  const exportMatch = path.match(/^\/api\/export\/([^/]+)$/)
  if (request.method === 'GET' && exportMatch) {
    if (!requireRole(user, response, ['Admin', 'Doctor', 'Staff'])) return
    const tableName = exportMatch[1]
    try {
      const csv = exportTableToCsv(tableName, user)
      response.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="medinexus-${tableName}-${new Date().toISOString().slice(0, 10)}.csv"`,
      })
      response.end(csv)
    } catch {
      sendError(response, 400, 'Invalid export entity requested.', 'BAD_REQUEST')
    }
    return
  }

  /* -------------------------------------------------------------------------
     HEALTH METRICS & NOTIFICATIONS
  ------------------------------------------------------------------------- */

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
