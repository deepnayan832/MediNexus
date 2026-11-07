import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

export type Role = 'Admin' | 'Doctor' | 'Staff' | 'Patient'

export type User = {
  id: string
  email: string
  name: string
  role: Role
  createdAt: string
}

type StoredUser = User & {
  passwordHash: string
  passwordSalt: string
}

type Row = Record<string, unknown>

const configuredDatabasePath = process.env.MEDINEXUS_DB_PATH ?? 'data/medinexus.sqlite'
if (process.env.NODE_ENV === 'production' && (!process.env.MEDINEXUS_DB_PATH || !isAbsolute(configuredDatabasePath))) {
  throw new Error('Production requires MEDINEXUS_DB_PATH to be set to an absolute path on persistent storage.')
}

const databasePath = resolve(configuredDatabasePath)
mkdirSync(dirname(databasePath), { recursive: true })

export const database = new DatabaseSync(databasePath)
database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;')
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Doctor', 'Staff', 'Patient')),
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    clinician_name TEXT NOT NULL,
    department TEXT NOT NULL,
    appointment_at TEXT NOT NULL,
    room TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS health_metrics (
    id TEXT PRIMARY KEY,
    patient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    goal_value REAL,
    recorded_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_health_metrics_patient ON health_metrics(patient_user_id, metric_type, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
`)

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${randomBytes(9).toString('hex')}`

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') }
}

export function verifyPassword(password: string, storedHash: string, salt: string) {
  const actualHash = scryptSync(password, salt, 64)
  const expectedHash = Buffer.from(storedHash, 'hex')
  return actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash)
}

export function databaseIsReady() {
  const result = database.prepare('SELECT 1 AS ok').get() as { ok?: number } | undefined
  return result?.ok === 1
}

function mapUser(row: Row): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: String(row.role) as Role,
    createdAt: String(row.created_at),
  }
}

function mapStoredUser(row: Row): StoredUser {
  return {
    ...mapUser(row),
    passwordHash: String(row.password_hash),
    passwordSalt: String(row.password_salt),
  }
}

export function getUserByEmail(email: string): StoredUser | null {
  const row = database.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as Row | undefined
  return row ? mapStoredUser(row) : null
}

export function getUserById(userId: string): User | null {
  const row = database.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(userId) as Row | undefined
  return row ? mapUser(row) : null
}

export function createUser(input: { email: string; name: string; password: string; role?: Role }) {
  const userId = id('usr')
  const createdAt = now()
  const { hash, salt } = hashPassword(input.password)
  const role = input.role ?? 'Patient'
  database.prepare(`INSERT INTO users (id, email, name, role, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    userId,
    normalizeEmail(input.email),
    input.name.trim(),
    role,
    hash,
    salt,
    createdAt,
  )
  if (role === 'Patient') {
    const patientId = `P-${randomBytes(3).toString('hex').toUpperCase()}`
    database.prepare(`INSERT INTO patients (id, user_id, name, department, status, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      patientId,
      userId,
      input.name.trim(),
      'General Medicine',
      'New intake',
      createdAt,
    )
    database.prepare(`INSERT INTO notifications (id, user_id, title, body, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id('ntf'),
      userId,
      'Welcome to MediNexus',
      'Your connected care workspace is ready to personalize.',
      'info',
      createdAt,
    )
    if (process.env.NODE_ENV !== 'production') {
      database.prepare(`INSERT INTO appointments (id, patient_id, clinician_name, department, appointment_at, room, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        id('apt'),
        patientId,
        'Dr. Elena Ruiz',
        'General Medicine',
        '2026-09-18T10:30:00.000Z',
        'Room 301',
        'Requested',
      )
      const baselineMetrics = [
        ['steps', 6842, 'steps', 8000],
        ['heart_rate', 72, 'bpm', null],
        ['sleep', 462, 'minutes', 480],
        ['hydration', 1.6, 'L', 2],
        ['blood_oxygen', 98, '%', null],
        ['weight', 68.4, 'kg', null],
      ] as const
      for (const [metricType, value, unit, goalValue] of baselineMetrics) {
        database.prepare(`INSERT INTO health_metrics (id, patient_user_id, metric_type, value, unit, goal_value, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          id('metric'),
          userId,
          metricType,
          value,
          unit,
          goalValue,
          createdAt,
        )
      }
    }
  }
  return getUserById(userId) as User
}

export function createSession(userId: string, expiresAt: string, tokenHash: string) {
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(tokenHash, userId, expiresAt, now())
}

export function getUserBySession(tokenHash: string): User | null {
  const row = database.prepare(`
    SELECT u.id, u.email, u.name, u.role, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(tokenHash, now()) as Row | undefined
  return row ? mapUser(row) : null
}

export function deleteSession(tokenHash: string) {
  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

export function audit(userId: string | null, action: string, entityType: string, entityId?: string) {
  database.prepare('INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
    id('aud'),
    userId,
    action,
    entityType,
    entityId ?? null,
    now(),
  )
}

export function listPatients(search: string) {
  const query = `%${search.trim()}%`
  return database.prepare(`
    SELECT id, name, department, status, created_at AS createdAt
    FROM patients
    WHERE name LIKE ? OR id LIKE ? OR department LIKE ?
    ORDER BY name ASC LIMIT 100
  `).all(query, query, query) as Row[]
}

export function listAppointments(user: User) {
  if (user.role === 'Patient') {
    return database.prepare(`
      SELECT a.id, p.id AS patientId, p.name AS patientName, a.clinician_name AS clinicianName, a.department, a.appointment_at AS appointmentAt, a.room, a.status
      FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE p.user_id = ? ORDER BY a.appointment_at ASC
    `).all(user.id) as Row[]
  }
  return database.prepare(`
    SELECT a.id, p.id AS patientId, p.name AS patientName, a.clinician_name AS clinicianName, a.department, a.appointment_at AS appointmentAt, a.room, a.status
    FROM appointments a JOIN patients p ON p.id = a.patient_id
    ORDER BY a.appointment_at ASC LIMIT 100
  `).all() as Row[]
}

export function getDashboardSummary(user: User) {
  if (user.role === 'Patient') {
    const appointments = Number((database.prepare(`
      SELECT COUNT(*) AS count FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE p.user_id = ?
    `).get(user.id) as Row).count)
    return { patients: 1, appointments, openEmergency: 0, database: 'sqlite' as const }
  }
  const patients = Number((database.prepare('SELECT COUNT(*) AS count FROM patients').get() as Row).count)
  const appointments = Number((database.prepare('SELECT COUNT(*) AS count FROM appointments').get() as Row).count)
  const openEmergency = Number((database.prepare(`SELECT COUNT(*) AS count FROM patients WHERE status IN ('Critical', 'Serious')`).get() as Row).count)
  return { patients, appointments, openEmergency, database: 'sqlite' as const }
}

export function createAppointmentForPatient(input: { userId: string; department: string; appointmentAt: string }) {
  const patient = database.prepare('SELECT id, name FROM patients WHERE user_id = ?').get(input.userId) as Row | undefined
  if (!patient) return null
  const appointmentId = id('apt')
  database.prepare(`INSERT INTO appointments (id, patient_id, clinician_name, department, appointment_at, room, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    appointmentId,
    String(patient.id),
    'Care team assignment pending',
    input.department,
    input.appointmentAt,
    'To be confirmed',
    'Requested',
  )
  return database.prepare(`
    SELECT a.id, p.id AS patientId, p.name AS patientName, a.clinician_name AS clinicianName, a.department, a.appointment_at AS appointmentAt, a.room, a.status
    FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
  `).get(appointmentId) as Row
}

export function listHealthMetrics(userId: string) {
  return database.prepare(`
    SELECT id, metric_type AS metricType, value, unit, goal_value AS goalValue, recorded_at AS recordedAt
    FROM health_metrics WHERE patient_user_id = ? ORDER BY recorded_at DESC LIMIT 250
  `).all(userId) as Row[]
}

export function createHealthMetric(input: { userId: string; metricType: string; value: number; unit: string; goalValue?: number; recordedAt: string }) {
  const metricId = id('metric')
  database.prepare(`INSERT INTO health_metrics (id, patient_user_id, metric_type, value, unit, goal_value, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    metricId,
    input.userId,
    input.metricType,
    input.value,
    input.unit,
    input.goalValue ?? null,
    input.recordedAt,
  )
  return database.prepare(`SELECT id, metric_type AS metricType, value, unit, goal_value AS goalValue, recorded_at AS recordedAt FROM health_metrics WHERE id = ?`).get(metricId) as Row
}

export function listNotifications(userId: string) {
  return database.prepare(`
    SELECT id, title, body, kind, read_at AS readAt, created_at AS createdAt
    FROM notifications WHERE user_id IS NULL OR user_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(userId) as Row[]
}

export function markNotificationRead(userId: string, notificationId: string) {
  database.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND (user_id IS NULL OR user_id = ?)`).run(now(), notificationId, userId)
}

export function markAllNotificationsRead(userId: string) {
  database.prepare(`UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND (user_id IS NULL OR user_id = ?)`).run(now(), userId)
}

function seedCoreData() {
  const seededPatients = [
    ['P-20391', 'Olivia Harris', 'Cardiology', 'Stable'],
    ['P-19402', 'James Patel', 'Internal Medicine', 'New intake'],
    ['P-18841', 'Maria Lopez', 'Surgery', 'Pre-op'],
    ['P-17438', 'Robert Chen', 'Endocrinology', 'Follow-up'],
  ]
  for (const [patientId, name, department, status] of seededPatients) {
    database.prepare(`INSERT OR IGNORE INTO patients (id, name, department, status, created_at) VALUES (?, ?, ?, ?, ?)`).run(patientId, name, department, status, now())
  }
  const appointments = [
    ['apt_0800', 'P-20391', 'Dr. Elena Ruiz', 'Cardiology', '2026-09-18T08:00:00.000Z', 'Room 301', 'Confirmed'],
    ['apt_0830', 'P-19402', 'Dr. Marcus Lee', 'Internal Medicine', '2026-09-18T08:30:00.000Z', 'Room 204', 'Confirmed'],
    ['apt_0900', 'P-18841', 'Dr. Priya Shah', 'Surgery', '2026-09-18T09:00:00.000Z', 'Room 312', 'Pre-op'],
  ]
  for (const appointment of appointments) {
    database.prepare(`INSERT OR IGNORE INTO appointments (id, patient_id, clinician_name, department, appointment_at, room, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(...appointment)
  }
  const notifications = [
    ['ntf_critical', null, 'Critical care alert', '2 patients are waiting for an ICU bed.', 'alert'],
    ['ntf_lab', null, 'Lab result ready', 'Robert Chen’s lipid panel is ready to review.', 'info'],
    ['ntf_handoff', null, 'Shift handoff complete', 'Ward B handoff was signed by James Wilson.', 'success'],
  ]
  for (const notification of notifications) {
    database.prepare(`INSERT OR IGNORE INTO notifications (id, user_id, title, body, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(...notification, now())
  }
}

function provisionUserFromEnvironment(prefix: 'ADMIN' | 'DOCTOR' | 'STAFF') {
  const email = process.env[`MEDINEXUS_${prefix}_EMAIL`]
  const password = process.env[`MEDINEXUS_${prefix}_PASSWORD`]
  if (!email || !password || getUserByEmail(email)) return
  const name = process.env[`MEDINEXUS_${prefix}_NAME`] ?? prefix[0] + prefix.slice(1).toLowerCase()
  createUser({ email, name, password, role: prefix === 'ADMIN' ? 'Admin' : prefix === 'DOCTOR' ? 'Doctor' : 'Staff' })
}

if (process.env.NODE_ENV !== 'production') seedCoreData()
provisionUserFromEnvironment('ADMIN')
provisionUserFromEnvironment('DOCTOR')
provisionUserFromEnvironment('STAFF')

