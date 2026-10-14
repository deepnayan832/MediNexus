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
type SqlParam = string | number | null

export type Patient = {
  id: string
  userId: string | null
  name: string
  department: string
  status: string
  dob?: string | null
  gender?: string | null
  phone?: string | null
  bloodGroup?: string | null
  allergies?: string | null
  createdAt: string
}

export type Appointment = {
  id: string
  patientId: string
  patientName?: string
  clinicianName: string
  department: string
  appointmentAt: string
  room: string
  status: string
  notes?: string | null
  createdByUserId?: string | null
}

export type Bed = {
  id: string
  ward: string
  roomNumber: string
  bedNumber: string
  bedType: string
  status: 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance'
  createdAt: string
}

export type Admission = {
  id: string
  patientId: string
  patientName?: string
  bedId: string
  ward?: string
  bedNumber?: string
  admittingDoctor: string
  diagnosis: string
  status: 'Admitted' | 'Discharged'
  admittedAt: string
  dischargedAt: string | null
}

export type EmergencyCase = {
  id: string
  patientId: string | null
  patientName: string
  age: number | null
  triageAcuity: number
  chiefComplaint: string
  vitals: string | null
  assignedTeam: string
  status: 'Triage' | 'In Treatment' | 'Awaiting Bed' | 'Discharged'
  arrivalTime: string
}

export type Medication = {
  id: string
  name: string
  code: string
  category: string
  stockQuantity: number
  unit: string
  reorderLevel: number
  unitPrice: number
  status: 'In stock' | 'Low stock' | 'Out of stock'
  createdAt: string
}

export type Prescription = {
  id: string
  patientId: string
  patientName?: string
  doctorId: string | null
  doctorName: string
  medicationId: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
  status: 'Active' | 'Dispensed' | 'Discontinued'
  prescribedAt: string
}

export type LabOrder = {
  id: string
  patientId: string
  patientName: string
  orderedByName: string
  testType: string
  priority: 'Routine' | 'Urgent' | 'Stat'
  status: 'Ordered' | 'In Progress' | 'Completed' | 'Cancelled'
  resultSummary: string | null
  normalRange: string | null
  interpretation: string | null
  orderedAt: string
  completedAt: string | null
}

export type BillingInvoice = {
  id: string
  patientId: string
  patientName: string
  invoiceNumber: string
  description: string
  amount: number
  insuranceCoverage: number
  patientDue: number
  status: 'Draft' | 'Pending' | 'Paid' | 'Overdue' | 'Disputed'
  dueDate: string
  createdAt: string
}

export type InsuranceClaim = {
  id: string
  invoiceId: string
  patientId: string
  patientName?: string
  providerName: string
  policyNumber: string
  claimAmount: number
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected'
  submittedAt: string
}

export type ClinicalNote = {
  id: string
  patientId: string
  patientName?: string
  authorId: string | null
  authorName: string
  noteType: string
  subjective: string
  objective: string
  assessment: string
  plan: string
  createdAt: string
}

const configuredDatabasePath = process.env.MEDINEXUS_DB_PATH?.trim()
if (process.env.NODE_ENV === 'production' && (!configuredDatabasePath || !isAbsolute(configuredDatabasePath))) {
  throw new Error('Production requires MEDINEXUS_DB_PATH to be an absolute path on persistent storage.')
}
const databasePath = resolve(configuredDatabasePath || 'data/medinexus.sqlite')
const demoDataEnabled = process.env.NODE_ENV !== 'production' && process.env.MEDINEXUS_DEMO_DATA !== 'false'
mkdirSync(dirname(databasePath), { recursive: true })

export const database = new DatabaseSync(databasePath)
database.exec('PRAGMA foreign_keys = ON;')
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
  CREATE TABLE IF NOT EXISTS notification_reads (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at TEXT NOT NULL,
    PRIMARY KEY (user_id, notification_id)
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS beds (
    id TEXT PRIMARY KEY,
    ward TEXT NOT NULL,
    room_number TEXT NOT NULL,
    bed_number TEXT NOT NULL,
    bed_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Available', 'Occupied', 'Cleaning', 'Maintenance')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admissions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
    admitting_doctor TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Admitted', 'Discharged')),
    admitted_at TEXT NOT NULL,
    discharged_at TEXT
  );
  CREATE TABLE IF NOT EXISTS emergency_cases (
    id TEXT PRIMARY KEY,
    patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
    patient_name TEXT NOT NULL,
    age INTEGER,
    triage_acuity INTEGER NOT NULL CHECK (triage_acuity BETWEEN 1 AND 5),
    chief_complaint TEXT NOT NULL,
    vitals TEXT,
    assigned_team TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Triage', 'In Treatment', 'Awaiting Bed', 'Discharged')),
    arrival_time TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS medications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL,
    unit TEXT NOT NULL,
    reorder_level INTEGER NOT NULL,
    unit_price REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('In stock', 'Low stock', 'Out of stock')),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    doctor_name TEXT NOT NULL,
    medication_id TEXT REFERENCES medications(id) ON DELETE RESTRICT,
    medication_name TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT NOT NULL,
    duration TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Dispensed', 'Discontinued')),
    prescribed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lab_orders (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    ordered_by_name TEXT NOT NULL,
    test_type TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('Routine', 'Urgent', 'Stat')),
    status TEXT NOT NULL CHECK (status IN ('Ordered', 'In Progress', 'Completed', 'Cancelled')),
    result_summary TEXT,
    normal_range TEXT,
    interpretation TEXT,
    ordered_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS billing_invoices (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    insurance_coverage REAL NOT NULL DEFAULT 0,
    patient_due REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft', 'Pending', 'Paid', 'Overdue', 'Disputed')),
    due_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS insurance_claims (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    provider_name TEXT NOT NULL,
    policy_number TEXT NOT NULL,
    claim_amount REAL NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'Rejected')),
    submitted_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS clinical_notes (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    note_type TEXT NOT NULL,
    subjective TEXT NOT NULL,
    objective TEXT NOT NULL,
    assessment TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
  CREATE INDEX IF NOT EXISTS idx_health_metrics_patient ON health_metrics(patient_user_id, metric_type, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads(user_id, read_at);
  CREATE INDEX IF NOT EXISTS idx_beds_ward ON beds(ward, status);
  CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id, status);
  CREATE INDEX IF NOT EXISTS idx_emergency_status ON emergency_cases(status, triage_acuity);
  CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id, status);
  CREATE INDEX IF NOT EXISTS idx_labs_patient ON lab_orders(patient_id, status);
  CREATE INDEX IF NOT EXISTS idx_invoices_patient ON billing_invoices(patient_id, status);
  CREATE INDEX IF NOT EXISTS idx_notes_patient ON clinical_notes(patient_id, created_at);
`)

// Safely add extended columns to existing tables
function addColumnIfNotExists(table: string, column: string, definition: string) {
  try {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`)
  } catch {
    // Column already exists
  }
}

addColumnIfNotExists('patients', 'dob', 'TEXT')
addColumnIfNotExists('patients', 'gender', 'TEXT')
addColumnIfNotExists('patients', 'phone', 'TEXT')
addColumnIfNotExists('patients', 'blood_group', 'TEXT')
addColumnIfNotExists('patients', 'allergies', 'TEXT')
addColumnIfNotExists('appointments', 'notes', 'TEXT')
addColumnIfNotExists('appointments', 'created_by_user_id', 'TEXT REFERENCES users(id)')

// Reset legacy shared read flags once per startup: read state now belongs to each user.
database.exec('UPDATE notifications SET read_at = NULL WHERE user_id IS NULL')

const now = () => new Date().toISOString()
const id = (prefix: string) => `${prefix}_${randomBytes(9).toString('hex')}`

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') }
}

export function verifyPassword(password: string, storedHash: string, salt: string) {
  const actual = scryptSync(password, salt, 64)
  const expected = Buffer.from(storedHash, 'hex')
  return expected.length === actual.length && timingSafeEqual(actual, expected)
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

export function getStoredUserById(userId: string): StoredUser | null {
  const row = database.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Row | undefined
  return row ? mapStoredUser(row) : null
}

export function updateUserProfile(userId: string, name: string, email: string) {
  const normalized = normalizeEmail(email)
  database.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name.trim(), normalized, userId)
  return getUserById(userId)
}

export function changeUserPassword(userId: string, newPassword: string) {
  const { hash, salt } = hashPassword(newPassword)
  database.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').run(hash, salt, userId)
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
    database.prepare(`INSERT INTO patients (id, user_id, name, department, status, dob, gender, blood_group, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      patientId,
      userId,
      input.name.trim(),
      'General Medicine',
      'Stable',
      '1992-05-14',
      'Other',
      'O+',
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
    if (demoDataEnabled) {
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

export function checkDatabaseHealth(): boolean {
  try {
    const row = database.prepare('SELECT 1 AS ok').get() as Row | undefined
    return Number(row?.ok) === 1
  } catch {
    return false
  }
}

export function createSession(userId: string, expiresAt: string, tokenHash: string) {
  const currentTime = now()
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(currentTime)
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(tokenHash, userId, expiresAt, currentTime)
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

export function revokeOtherUserSessions(userId: string, keepTokenHash?: string | null) {
  if (keepTokenHash) {
    database.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').run(userId, keepTokenHash)
  } else {
    database.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  }
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

export function listAuditLogs(limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)))
  return database.prepare(`
    SELECT a.id, a.user_id AS userId, COALESCE(u.name, 'System') AS userName, COALESCE(u.role, 'System') AS userRole, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.created_at AS createdAt
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(safeLimit) as Row[]
}

/* =========================================================================
   PATIENTS
========================================================================= */

export function listPatients(search: string = '', department?: string, status?: string) {
  const query = `%${search.trim()}%`
  let sql = `
    SELECT id, user_id AS userId, name, department, status, dob, gender, phone, blood_group AS bloodGroup, allergies, created_at AS createdAt
    FROM patients
    WHERE (name LIKE ? OR id LIKE ? OR department LIKE ?)
  `
  const params: SqlParam[] = [query, query, query]
  if (department) {
    sql += ' AND department = ?'
    params.push(department)
  }
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  sql += ' ORDER BY name ASC LIMIT 200'
  return database.prepare(sql).all(...params) as Row[]
}

export function getPatientById(patientId: string) {
  const row = database.prepare(`
    SELECT id, user_id AS userId, name, department, status, dob, gender, phone, blood_group AS bloodGroup, allergies, created_at AS createdAt
    FROM patients WHERE id = ?
  `).get(patientId) as Row | undefined
  return row ?? null
}

export function getPatientByUserId(userId: string) {
  const row = database.prepare(`
    SELECT id, user_id AS userId, name, department, status, dob, gender, phone, blood_group AS bloodGroup, allergies, created_at AS createdAt
    FROM patients WHERE user_id = ?
  `).get(userId) as Row | undefined
  return row ?? null
}

export function createPatient(input: {
  name: string
  department: string
  status?: string
  dob?: string
  gender?: string
  phone?: string
  bloodGroup?: string
  allergies?: string
  userId?: string
}) {
  const patientId = `P-${randomBytes(3).toString('hex').toUpperCase()}`
  const createdAt = now()
  database.prepare(`
    INSERT INTO patients (id, user_id, name, department, status, dob, gender, phone, blood_group, allergies, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientId,
    input.userId ?? null,
    input.name.trim(),
    input.department.trim(),
    input.status ?? 'New intake',
    input.dob ?? null,
    input.gender ?? null,
    input.phone ?? null,
    input.bloodGroup ?? null,
    input.allergies ?? null,
    createdAt,
  )
  return getPatientById(patientId)
}

export function updatePatient(
  patientId: string,
  input: {
    name?: string
    department?: string
    status?: string
    dob?: string
    gender?: string
    phone?: string
    bloodGroup?: string
    allergies?: string
  },
) {
  const current = getPatientById(patientId)
  if (!current) return null
  database.prepare(`
    UPDATE patients
    SET name = COALESCE(?, name),
        department = COALESCE(?, department),
        status = COALESCE(?, status),
        dob = COALESCE(?, dob),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        blood_group = COALESCE(?, blood_group),
        allergies = COALESCE(?, allergies)
    WHERE id = ?
  `).run(
    input.name?.trim() ?? null,
    input.department?.trim() ?? null,
    input.status ?? null,
    input.dob ?? null,
    input.gender ?? null,
    input.phone ?? null,
    input.bloodGroup ?? null,
    input.allergies ?? null,
    patientId,
  )
  return getPatientById(patientId)
}

/* =========================================================================
   APPOINTMENTS
========================================================================= */

export function listAppointments(user: User, filters?: { date?: string; department?: string; status?: string }) {
  let sql = `
    SELECT a.id, p.id AS patientId, p.name AS patientName, a.clinician_name AS clinicianName, a.department, a.appointment_at AS appointmentAt, a.room, a.status, a.notes
    FROM appointments a JOIN patients p ON p.id = a.patient_id
  `
  const params: SqlParam[] = []
  const conditions: string[] = []

  if (user.role === 'Patient') {
    conditions.push('p.user_id = ?')
    params.push(user.id)
  }

  if (filters?.department) {
    conditions.push('a.department = ?')
    params.push(filters.department)
  }

  if (filters?.status) {
    conditions.push('a.status = ?')
    params.push(filters.status)
  }

  if (filters?.date) {
    conditions.push("date(a.appointment_at) = date(?)")
    params.push(filters.date)
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }

  sql += ' ORDER BY a.appointment_at ASC LIMIT 200'
  return database.prepare(sql).all(...params) as Row[]
}

export function getAppointmentById(id: string) {
  const row = database.prepare(`
    SELECT a.id, p.id AS patientId, p.name AS patientName, a.clinician_name AS clinicianName, a.department, a.appointment_at AS appointmentAt, a.room, a.status, a.notes
    FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE a.id = ?
  `).get(id) as Row | undefined
  return row ?? null
}

export function createAppointment(input: {
  patientId: string
  clinicianName: string
  department: string
  appointmentAt: string
  room?: string
  status?: string
  notes?: string
  createdByUserId?: string
}) {
  const appointmentId = id('apt')
  database.prepare(`
    INSERT INTO appointments (id, patient_id, clinician_name, department, appointment_at, room, status, notes, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    appointmentId,
    input.patientId,
    input.clinicianName.trim(),
    input.department.trim(),
    input.appointmentAt,
    input.room?.trim() || 'TBD',
    input.status || 'Confirmed',
    input.notes?.trim() || null,
    input.createdByUserId ?? null,
  )
  return getAppointmentById(appointmentId)
}

export function createAppointmentForPatient(input: {
  userId: string
  department: string
  appointmentAt: string
  clinicianName?: string
  notes?: string
}) {
  const patient = database.prepare('SELECT id, name FROM patients WHERE user_id = ?').get(input.userId) as Row | undefined
  if (!patient) return null
  const appointmentId = id('apt')
  database.prepare(`
    INSERT INTO appointments (id, patient_id, clinician_name, department, appointment_at, room, status, notes, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    appointmentId,
    String(patient.id),
    input.clinicianName?.trim() || 'Care team assignment pending',
    input.department,
    input.appointmentAt,
    'To be confirmed',
    'Requested',
    input.notes?.trim() || null,
    input.userId,
  )
  return getAppointmentById(appointmentId)
}

export function updateAppointment(
  appointmentId: string,
  input: {
    clinicianName?: string
    department?: string
    appointmentAt?: string
    room?: string
    status?: string
    notes?: string
  },
) {
  const current = getAppointmentById(appointmentId)
  if (!current) return null
  database.prepare(`
    UPDATE appointments
    SET clinician_name = COALESCE(?, clinician_name),
        department = COALESCE(?, department),
        appointment_at = COALESCE(?, appointment_at),
        room = COALESCE(?, room),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(
    input.clinicianName?.trim() ?? null,
    input.department?.trim() ?? null,
    input.appointmentAt ?? null,
    input.room?.trim() ?? null,
    input.status ?? null,
    input.notes?.trim() ?? null,
    appointmentId,
  )
  return getAppointmentById(appointmentId)
}

/* =========================================================================
   INPATIENT BEDS & ADMISSIONS
========================================================================= */

export function listBeds(ward?: string, status?: string) {
  let sql = `SELECT id, ward, room_number AS roomNumber, bed_number AS bedNumber, bed_type AS bedType, status, created_at AS createdAt FROM beds`
  const conditions: string[] = []
  const params: SqlParam[] = []
  if (ward) {
    conditions.push('ward = ?')
    params.push(ward)
  }
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY ward ASC, room_number ASC, bed_number ASC'
  return database.prepare(sql).all(...params) as Row[]
}

export function getBedById(bedId: string) {
  return database.prepare(`SELECT id, ward, room_number AS roomNumber, bed_number AS bedNumber, bed_type AS bedType, status, created_at AS createdAt FROM beds WHERE id = ?`).get(bedId) as Row | undefined ?? null
}

export function createBed(input: { ward: string; roomNumber: string; bedNumber: string; bedType: string }) {
  const bedId = id('bed')
  database.prepare(`INSERT INTO beds (id, ward, room_number, bed_number, bed_type, status, created_at) VALUES (?, ?, ?, ?, ?, 'Available', ?)`).run(
    bedId,
    input.ward.trim(),
    input.roomNumber.trim(),
    input.bedNumber.trim(),
    input.bedType.trim(),
    now(),
  )
  return getBedById(bedId)
}

export function updateBedStatus(bedId: string, status: 'Available' | 'Occupied' | 'Cleaning' | 'Maintenance') {
  const existing = getBedById(bedId)
  if (!existing) return null
  database.prepare(`UPDATE beds SET status = ? WHERE id = ?`).run(status, bedId)
  return getBedById(bedId)
}

export function getAdmissionById(admissionId: string) {
  return database.prepare(`
    SELECT a.id, a.patient_id AS patientId, p.name AS patientName, a.bed_id AS bedId, b.ward, b.bed_number AS bedNumber, a.admitting_doctor AS admittingDoctor, a.diagnosis, a.status, a.admitted_at AS admittedAt, a.discharged_at AS dischargedAt
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    JOIN beds b ON b.id = a.bed_id
    WHERE a.id = ?
  `).get(admissionId) as Row | undefined ?? null
}

export function listAdmissions(status?: string) {
  let sql = `
    SELECT a.id, a.patient_id AS patientId, p.name AS patientName, a.bed_id AS bedId, b.ward, b.bed_number AS bedNumber, a.admitting_doctor AS admittingDoctor, a.diagnosis, a.status, a.admitted_at AS admittedAt, a.discharged_at AS dischargedAt
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    JOIN beds b ON b.id = a.bed_id
  `
  const params: SqlParam[] = []
  if (status) {
    sql += ' WHERE a.status = ?'
    params.push(status)
  }
  sql += ' ORDER BY a.admitted_at DESC LIMIT 100'
  return database.prepare(sql).all(...params) as Row[]
}

export function createAdmission(input: { patientId: string; bedId: string; admittingDoctor: string; diagnosis: string }) {
  const admissionId = id('adm')
  database.prepare(`INSERT INTO admissions (id, patient_id, bed_id, admitting_doctor, diagnosis, status, admitted_at) VALUES (?, ?, ?, ?, ?, 'Admitted', ?)`).run(
    admissionId,
    input.patientId,
    input.bedId,
    input.admittingDoctor.trim(),
    input.diagnosis.trim(),
    now(),
  )
  database.prepare(`UPDATE beds SET status = 'Occupied' WHERE id = ?`).run(input.bedId)
  return database.prepare(`
    SELECT a.id, a.patient_id AS patientId, p.name AS patientName, a.bed_id AS bedId, b.ward, b.bed_number AS bedNumber, a.admitting_doctor AS admittingDoctor, a.diagnosis, a.status, a.admitted_at AS admittedAt, a.discharged_at AS dischargedAt
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    JOIN beds b ON b.id = a.bed_id
    WHERE a.id = ?
  `).get(admissionId) as Row
}

export function dischargeAdmission(admissionId: string) {
  const current = database.prepare(`SELECT bed_id FROM admissions WHERE id = ?`).get(admissionId) as Row | undefined
  if (!current) return null
  const dischargedAt = now()
  database.prepare(`UPDATE admissions SET status = 'Discharged', discharged_at = ? WHERE id = ?`).run(dischargedAt, admissionId)
  database.prepare(`UPDATE beds SET status = 'Cleaning' WHERE id = ?`).run(String(current.bed_id))
  return database.prepare(`
    SELECT a.id, a.patient_id AS patientId, p.name AS patientName, a.bed_id AS bedId, b.ward, b.bed_number AS bedNumber, a.admitting_doctor AS admittingDoctor, a.diagnosis, a.status, a.admitted_at AS admittedAt, a.discharged_at AS dischargedAt
    FROM admissions a
    JOIN patients p ON p.id = a.patient_id
    JOIN beds b ON b.id = a.bed_id
    WHERE a.id = ?
  `).get(admissionId) as Row
}

/* =========================================================================
   EMERGENCY DEPARTMENT & TRIAGE
========================================================================= */

export function listEmergencyCases(status?: string, maxAcuity?: number) {
  let sql = `
    SELECT id, patient_id AS patientId, patient_name AS patientName, age, triage_acuity AS triageAcuity, chief_complaint AS chiefComplaint, vitals, assigned_team AS assignedTeam, status, arrival_time AS arrivalTime
    FROM emergency_cases
  `
  const conditions: string[] = []
  const params: SqlParam[] = []
  if (status) {
    conditions.push('status = ?')
    params.push(status)
  }
  if (maxAcuity) {
    conditions.push('triage_acuity <= ?')
    params.push(maxAcuity)
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY triage_acuity ASC, arrival_time DESC LIMIT 100'
  return database.prepare(sql).all(...params) as Row[]
}

export function getEmergencyCaseById(id: string) {
  return database.prepare(`
    SELECT id, patient_id AS patientId, patient_name AS patientName, age, triage_acuity AS triageAcuity, chief_complaint AS chiefComplaint, vitals, assigned_team AS assignedTeam, status, arrival_time AS arrivalTime
    FROM emergency_cases WHERE id = ?
  `).get(id) as Row | undefined ?? null
}

export function createEmergencyCase(input: {
  patientId?: string
  patientName: string
  age?: number
  triageAcuity: number
  chiefComplaint: string
  vitals?: string
  assignedTeam: string
}) {
  const caseId = id('ed')
  database.prepare(`
    INSERT INTO emergency_cases (id, patient_id, patient_name, age, triage_acuity, chief_complaint, vitals, assigned_team, status, arrival_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Triage', ?)
  `).run(
    caseId,
    input.patientId ?? null,
    input.patientName.trim(),
    input.age ?? null,
    input.triageAcuity,
    input.chiefComplaint.trim(),
    input.vitals?.trim() || null,
    input.assignedTeam.trim(),
    now(),
  )
  return getEmergencyCaseById(caseId)
}

export function updateEmergencyCase(
  caseId: string,
  input: {
    status?: 'Triage' | 'In Treatment' | 'Awaiting Bed' | 'Discharged'
    triageAcuity?: number
    assignedTeam?: string
    vitals?: string
    chiefComplaint?: string
  },
) {
  database.prepare(`
    UPDATE emergency_cases
    SET status = COALESCE(?, status),
        triage_acuity = COALESCE(?, triage_acuity),
        assigned_team = COALESCE(?, assigned_team),
        vitals = COALESCE(?, vitals),
        chief_complaint = COALESCE(?, chief_complaint)
    WHERE id = ?
  `).run(
    input.status ?? null,
    input.triageAcuity ?? null,
    input.assignedTeam?.trim() ?? null,
    input.vitals?.trim() ?? null,
    input.chiefComplaint?.trim() ?? null,
    caseId,
  )
  return getEmergencyCaseById(caseId)
}

/* =========================================================================
   PHARMACY & PRESCRIPTIONS
========================================================================= */

export function listMedications(search: string = '', status?: string) {
  const query = `%${search.trim()}%`
  let sql = `
    SELECT id, name, code, category, stock_quantity AS stockQuantity, unit, reorder_level AS reorderLevel, unit_price AS unitPrice, status, created_at AS createdAt
    FROM medications WHERE (name LIKE ? OR code LIKE ? OR category LIKE ?)
  `
  const params: SqlParam[] = [query, query, query]
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  sql += ' ORDER BY name ASC LIMIT 150'
  return database.prepare(sql).all(...params) as Row[]
}

export function getMedicationById(id: string) {
  return database.prepare(`SELECT id, name, code, category, stock_quantity AS stockQuantity, unit, reorder_level AS reorderLevel, unit_price AS unitPrice, status, created_at AS createdAt FROM medications WHERE id = ?`).get(id) as Row | undefined ?? null
}

export function getMedicationByName(name: string) {
  return database.prepare(`SELECT id, name, code, category, stock_quantity AS stockQuantity, unit, reorder_level AS reorderLevel, unit_price AS unitPrice, status, created_at AS createdAt FROM medications WHERE lower(name) = lower(?) OR lower(code) = lower(?)`).get(name.trim(), name.trim()) as Row | undefined ?? null
}

export function createMedication(input: {
  name: string
  code: string
  category: string
  stockQuantity: number
  unit: string
  reorderLevel: number
  unitPrice: number
}) {
  const medId = id('med')
  const status = input.stockQuantity === 0 ? 'Out of stock' : input.stockQuantity <= input.reorderLevel ? 'Low stock' : 'In stock'
  database.prepare(`
    INSERT INTO medications (id, name, code, category, stock_quantity, unit, reorder_level, unit_price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    medId,
    input.name.trim(),
    input.code.trim().toUpperCase(),
    input.category.trim(),
    input.stockQuantity,
    input.unit.trim(),
    input.reorderLevel,
    input.unitPrice,
    status,
    now(),
  )
  return getMedicationById(medId)
}

export function updateMedicationStock(medId: string, stockQuantity: number) {
  const med = getMedicationById(medId)
  if (!med) return null
  const reorder = Number(med.reorderLevel)
  const status = stockQuantity <= 0 ? 'Out of stock' : stockQuantity <= reorder ? 'Low stock' : 'In stock'
  database.prepare(`UPDATE medications SET stock_quantity = ?, status = ? WHERE id = ?`).run(stockQuantity, status, medId)
  return getMedicationById(medId)
}

export function listPrescriptions(user: User, patientId?: string) {
  let sql = `
    SELECT pr.id, pr.patient_id AS patientId, p.name AS patientName, pr.doctor_id AS doctorId, pr.doctor_name AS doctorName, pr.medication_id AS medicationId, pr.medication_name AS medicationName, pr.dosage, pr.frequency, pr.duration, pr.status, pr.prescribed_at AS prescribedAt
    FROM prescriptions pr
    JOIN patients p ON p.id = pr.patient_id
  `
  const conditions: string[] = []
  const params: SqlParam[] = []
  if (user.role === 'Patient') {
    conditions.push('p.user_id = ?')
    params.push(user.id)
  } else if (patientId) {
    conditions.push('pr.patient_id = ?')
    params.push(patientId)
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY pr.prescribed_at DESC LIMIT 100'
  return database.prepare(sql).all(...params) as Row[]
}

export function createPrescription(input: {
  patientId: string
  doctorId?: string
  doctorName: string
  medicationId: string
  medicationName: string
  dosage: string
  frequency: string
  duration: string
}) {
  const rxId = id('rx')
  database.prepare(`
    INSERT INTO prescriptions (id, patient_id, doctor_id, doctor_name, medication_id, medication_name, dosage, frequency, duration, status, prescribed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
  `).run(
    rxId,
    input.patientId,
    input.doctorId ?? null,
    input.doctorName.trim(),
    input.medicationId,
    input.medicationName.trim(),
    input.dosage.trim(),
    input.frequency.trim(),
    input.duration.trim(),
    now(),
  )
  return database.prepare(`
    SELECT pr.id, pr.patient_id AS patientId, p.name AS patientName, pr.doctor_id AS doctorId, pr.doctor_name AS doctorName, pr.medication_id AS medicationId, pr.medication_name AS medicationName, pr.dosage, pr.frequency, pr.duration, pr.status, pr.prescribed_at AS prescribedAt
    FROM prescriptions pr
    JOIN patients p ON p.id = pr.patient_id
    WHERE pr.id = ?
  `).get(rxId) as Row
}

export function getPrescriptionById(rxId: string) {
  return database.prepare(`
    SELECT pr.id, pr.patient_id AS patientId, p.name AS patientName, pr.doctor_id AS doctorId, pr.doctor_name AS doctorName, pr.medication_id AS medicationId, pr.medication_name AS medicationName, pr.dosage, pr.frequency, pr.duration, pr.status, pr.prescribed_at AS prescribedAt
    FROM prescriptions pr
    JOIN patients p ON p.id = pr.patient_id
    WHERE pr.id = ?
  `).get(rxId) as Row | undefined ?? null
}

export function dispensePrescription(rxId: string) {
  const existing = getPrescriptionById(rxId)
  if (!existing) return null
  database.prepare(`UPDATE prescriptions SET status = 'Dispensed' WHERE id = ?`).run(rxId)
  if (existing.medicationId) {
    const med = getMedicationById(String(existing.medicationId))
    if (med) {
      const nextStock = Math.max(0, Number(med.stockQuantity) - 1)
      updateMedicationStock(String(med.id), nextStock)
    }
  }
  return getPrescriptionById(rxId)
}

/* =========================================================================
   LABS & DIAGNOSTICS
========================================================================= */

export function listLabOrders(user: User, patientId?: string, status?: string) {
  let sql = `
    SELECT l.id, l.patient_id AS patientId, l.patient_name AS patientName, l.ordered_by_name AS orderedByName, l.test_type AS testType, l.priority, l.status, l.result_summary AS resultSummary, l.normal_range AS normalRange, l.interpretation, l.ordered_at AS orderedAt, l.completed_at AS completedAt
    FROM lab_orders l
    JOIN patients p ON p.id = l.patient_id
  `
  const conditions: string[] = []
  const params: SqlParam[] = []
  if (user.role === 'Patient') {
    conditions.push('p.user_id = ?')
    params.push(user.id)
  } else if (patientId) {
    conditions.push('l.patient_id = ?')
    params.push(patientId)
  }
  if (status) {
    conditions.push('l.status = ?')
    params.push(status)
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY l.ordered_at DESC LIMIT 150'
  return database.prepare(sql).all(...params) as Row[]
}

export function getLabOrderById(id: string) {
  return database.prepare(`
    SELECT id, patient_id AS patientId, patient_name AS patientName, ordered_by_name AS orderedByName, test_type AS testType, priority, status, result_summary AS resultSummary, normal_range AS normalRange, interpretation, ordered_at AS orderedAt, completed_at AS completedAt
    FROM lab_orders WHERE id = ?
  `).get(id) as Row | undefined ?? null
}

export function createLabOrder(input: {
  patientId: string
  patientName: string
  orderedByName: string
  testType: string
  priority?: 'Routine' | 'Urgent' | 'Stat'
  resultSummary?: string
}) {
  const labId = id('lab')
  database.prepare(`
    INSERT INTO lab_orders (id, patient_id, patient_name, ordered_by_name, test_type, priority, status, result_summary, ordered_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Ordered', ?, ?)
  `).run(
    labId,
    input.patientId,
    input.patientName.trim(),
    input.orderedByName.trim(),
    input.testType.trim(),
    input.priority ?? 'Routine',
    input.resultSummary?.trim() || null,
    now(),
  )
  return getLabOrderById(labId)
}

export function updateLabOrder(
  labId: string,
  input: {
    status?: 'Ordered' | 'In Progress' | 'Completed' | 'Cancelled'
    resultSummary?: string
    normalRange?: string
    interpretation?: string
  },
) {
  const completedAt = input.status === 'Completed' ? now() : null
  database.prepare(`
    UPDATE lab_orders
    SET status = COALESCE(?, status),
        result_summary = COALESCE(?, result_summary),
        normal_range = COALESCE(?, normal_range),
        interpretation = COALESCE(?, interpretation),
        completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END
    WHERE id = ?
  `).run(
    input.status ?? null,
    input.resultSummary?.trim() ?? null,
    input.normalRange?.trim() ?? null,
    input.interpretation?.trim() ?? null,
    completedAt,
    completedAt,
    labId,
  )
  return getLabOrderById(labId)
}

/* =========================================================================
   BILLING & INVOICES & INSURANCE
========================================================================= */

export function listInvoices(user: User, patientId?: string, status?: string) {
  let sql = `
    SELECT b.id, b.patient_id AS patientId, b.patient_name AS patientName, b.invoice_number AS invoiceNumber, b.description, b.amount, b.insurance_coverage AS insuranceCoverage, b.patient_due AS patientDue, b.status, b.due_date AS dueDate, b.created_at AS createdAt
    FROM billing_invoices b
    JOIN patients p ON p.id = b.patient_id
  `
  const conditions: string[] = []
  const params: SqlParam[] = []
  if (user.role === 'Patient') {
    conditions.push('p.user_id = ?')
    params.push(user.id)
  } else if (patientId) {
    conditions.push('b.patient_id = ?')
    params.push(patientId)
  }
  if (status) {
    conditions.push('b.status = ?')
    params.push(status)
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ')
  sql += ' ORDER BY b.created_at DESC LIMIT 100'
  return database.prepare(sql).all(...params) as Row[]
}

export function getInvoiceById(id: string) {
  return database.prepare(`
    SELECT id, patient_id AS patientId, patient_name AS patientName, invoice_number AS invoiceNumber, description, amount, insurance_coverage AS insuranceCoverage, patient_due AS patientDue, status, due_date AS dueDate, created_at AS createdAt
    FROM billing_invoices WHERE id = ?
  `).get(id) as Row | undefined ?? null
}

export function createInvoice(input: {
  patientId: string
  patientName: string
  description: string
  amount: number
  insuranceCoverage?: number
  dueDate: string
}) {
  const invId = id('inv')
  const invNum = `INV-${Date.now().toString().slice(-6)}-${randomBytes(2).toString('hex').toUpperCase()}`
  const coverage = input.insuranceCoverage ?? 0
  const patientDue = Math.max(0, input.amount - coverage)
  database.prepare(`
    INSERT INTO billing_invoices (id, patient_id, patient_name, invoice_number, description, amount, insurance_coverage, patient_due, status, due_date, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
  `).run(
    invId,
    input.patientId,
    input.patientName.trim(),
    invNum,
    input.description.trim(),
    input.amount,
    coverage,
    patientDue,
    input.dueDate,
    now(),
  )
  return getInvoiceById(invId)
}

export function payInvoice(invoiceId: string) {
  database.prepare(`UPDATE billing_invoices SET status = 'Paid', patient_due = 0 WHERE id = ?`).run(invoiceId)
  return getInvoiceById(invoiceId)
}

export function listInsuranceClaims(user: User) {
  let sql = `
    SELECT c.id, c.invoice_id AS invoiceId, c.patient_id AS patientId, p.name AS patientName, c.provider_name AS providerName, c.policy_number AS policyNumber, c.claim_amount AS claimAmount, c.status, c.submitted_at AS submittedAt
    FROM insurance_claims c
    JOIN patients p ON p.id = c.patient_id
  `
  const params: SqlParam[] = []
  if (user.role === 'Patient') {
    sql += ' WHERE p.user_id = ?'
    params.push(user.id)
  }
  sql += ' ORDER BY c.submitted_at DESC LIMIT 100'
  return database.prepare(sql).all(...params) as Row[]
}

export function createInsuranceClaim(input: {
  invoiceId: string
  patientId: string
  providerName: string
  policyNumber: string
  claimAmount: number
}) {
  const claimId = id('clm')
  database.prepare(`
    INSERT INTO insurance_claims (id, invoice_id, patient_id, provider_name, policy_number, claim_amount, status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, 'Submitted', ?)
  `).run(
    claimId,
    input.invoiceId,
    input.patientId,
    input.providerName.trim(),
    input.policyNumber.trim(),
    input.claimAmount,
    now(),
  )
  return database.prepare(`
    SELECT c.id, c.invoice_id AS invoiceId, c.patient_id AS patientId, p.name AS patientName, c.provider_name AS providerName, c.policy_number AS policyNumber, c.claim_amount AS claimAmount, c.status, c.submitted_at AS submittedAt
    FROM insurance_claims c
    JOIN patients p ON p.id = c.patient_id
    WHERE c.id = ?
  `).get(claimId) as Row
}

/* =========================================================================
   CLINICAL NOTES
========================================================================= */

export function listClinicalNotes(patientId: string | undefined, user: User) {
  if (user.role === 'Patient') {
    const patient = database.prepare('SELECT id FROM patients WHERE user_id = ?').get(user.id) as Row | undefined
    if (!patient) return []
    if (patientId && String(patient.id) !== patientId) return []
    return database.prepare(`
      SELECT cn.id, cn.patient_id AS patientId, p.name AS patientName, cn.author_id AS authorId, cn.author_name AS authorName, cn.note_type AS noteType, cn.subjective, cn.objective, cn.assessment, cn.plan, cn.created_at AS createdAt
      FROM clinical_notes cn
      JOIN patients p ON p.id = cn.patient_id
      WHERE cn.patient_id = ?
      ORDER BY cn.created_at DESC LIMIT 100
    `).all(String(patient.id)) as Row[]
  }
  if (patientId) {
    return database.prepare(`
      SELECT cn.id, cn.patient_id AS patientId, p.name AS patientName, cn.author_id AS authorId, cn.author_name AS authorName, cn.note_type AS noteType, cn.subjective, cn.objective, cn.assessment, cn.plan, cn.created_at AS createdAt
      FROM clinical_notes cn
      JOIN patients p ON p.id = cn.patient_id
      WHERE cn.patient_id = ?
      ORDER BY cn.created_at DESC LIMIT 100
    `).all(patientId) as Row[]
  }
  return database.prepare(`
    SELECT cn.id, cn.patient_id AS patientId, p.name AS patientName, cn.author_id AS authorId, cn.author_name AS authorName, cn.note_type AS noteType, cn.subjective, cn.objective, cn.assessment, cn.plan, cn.created_at AS createdAt
    FROM clinical_notes cn
    JOIN patients p ON p.id = cn.patient_id
    ORDER BY cn.created_at DESC LIMIT 100
  `).all() as Row[]
}

export function createClinicalNote(input: {
  patientId: string
  authorId?: string
  authorName: string
  noteType: string
  subjective: string
  objective: string
  assessment: string
  plan: string
}) {
  const noteId = id('note')
  database.prepare(`
    INSERT INTO clinical_notes (id, patient_id, author_id, author_name, note_type, subjective, objective, assessment, plan, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    noteId,
    input.patientId,
    input.authorId ?? null,
    input.authorName.trim(),
    input.noteType.trim(),
    input.subjective.trim(),
    input.objective.trim(),
    input.assessment.trim(),
    input.plan.trim(),
    now(),
  )
  return database.prepare(`
    SELECT cn.id, cn.patient_id AS patientId, p.name AS patientName, cn.author_id AS authorId, cn.author_name AS authorName, cn.note_type AS noteType, cn.subjective, cn.objective, cn.assessment, cn.plan, cn.created_at AS createdAt
    FROM clinical_notes cn
    JOIN patients p ON p.id = cn.patient_id
    WHERE cn.id = ?
  `).get(noteId) as Row
}

/* =========================================================================
   DASHBOARD SUMMARY
========================================================================= */

export function getDashboardSummary(user: User) {
  if (user.role === 'Patient') {
    const appointments = Number((database.prepare(`
      SELECT COUNT(*) AS count FROM appointments a JOIN patients p ON p.id = a.patient_id WHERE p.user_id = ?
    `).get(user.id) as Row).count)
    const activePrescriptions = Number((database.prepare(`
      SELECT COUNT(*) AS count FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id WHERE p.user_id = ? AND pr.status = 'Active'
    `).get(user.id) as Row).count)
    const pendingLabs = Number((database.prepare(`
      SELECT COUNT(*) AS count FROM lab_orders l JOIN patients p ON p.id = l.patient_id WHERE p.user_id = ? AND l.status != 'Completed'
    `).get(user.id) as Row).count)
    const outstandingBalance = Number((database.prepare(`
      SELECT COALESCE(SUM(b.patient_due), 0) AS total FROM billing_invoices b JOIN patients p ON p.id = b.patient_id WHERE p.user_id = ? AND b.status IN ('Pending', 'Overdue')
    `).get(user.id) as Row).total)
    return {
      patients: 1,
      appointments,
      activePrescriptions,
      pendingLabs,
      outstandingBalance,
      openEmergency: 0,
      database: 'sqlite' as const,
    }
  }

  const patients = Number((database.prepare('SELECT COUNT(*) AS count FROM patients').get() as Row).count)
  const appointments = Number((database.prepare('SELECT COUNT(*) AS count FROM appointments').get() as Row).count)
  const openEmergency = Number((database.prepare(`SELECT COUNT(*) AS count FROM emergency_cases WHERE status != 'Discharged'`).get() as Row).count)
  const criticalEmergency = Number((database.prepare(`SELECT COUNT(*) AS count FROM emergency_cases WHERE status != 'Discharged' AND triage_acuity <= 2`).get() as Row).count)
  
  const totalBeds = Number((database.prepare('SELECT COUNT(*) AS count FROM beds').get() as Row).count)
  const occupiedBeds = Number((database.prepare(`SELECT COUNT(*) AS count FROM beds WHERE status = 'Occupied'`).get() as Row).count)
  const bedOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0
  
  const pendingLabs = Number((database.prepare(`SELECT COUNT(*) AS count FROM lab_orders WHERE status IN ('Ordered', 'In Progress')`).get() as Row).count)
  const monthlyRevenue = Number((database.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM billing_invoices WHERE status = 'Paid'`).get() as Row).total)
  const lowStockMeds = Number((database.prepare(`SELECT COUNT(*) AS count FROM medications WHERE status IN ('Low stock', 'Out of stock')`).get() as Row).count)

  return {
    patients,
    appointments,
    openEmergency,
    criticalEmergency,
    totalBeds,
    occupiedBeds,
    bedOccupancyRate,
    pendingLabs,
    monthlyRevenue,
    lowStockMeds,
    database: 'sqlite' as const,
  }
}

/* =========================================================================
   CSV EXPORT
========================================================================= */

export function exportTableToCsv(tableName: string, user: User): string {
  const allowedTables = ['patients', 'appointments', 'beds', 'admissions', 'emergency_cases', 'medications', 'prescriptions', 'lab_orders', 'billing_invoices', 'insurance_claims', 'clinical_notes']
  if (!allowedTables.includes(tableName)) {
    throw new Error('Table not permitted for export.')
  }

  let rows: Row[] = []
  if (tableName === 'patients') {
    rows = listPatients()
  } else if (tableName === 'appointments') {
    rows = listAppointments(user)
  } else if (tableName === 'beds') {
    rows = listBeds()
  } else if (tableName === 'admissions') {
    rows = listAdmissions()
  } else if (tableName === 'emergency_cases') {
    rows = listEmergencyCases()
  } else if (tableName === 'medications') {
    rows = listMedications()
  } else if (tableName === 'prescriptions') {
    rows = listPrescriptions(user)
  } else if (tableName === 'lab_orders') {
    rows = listLabOrders(user)
  } else if (tableName === 'billing_invoices') {
    rows = listInvoices(user)
  } else if (tableName === 'insurance_claims') {
    rows = listInsuranceClaims(user)
  } else if (tableName === 'clinical_notes') {
    rows = listClinicalNotes(undefined, user)
  }

  if (rows.length === 0) return 'No records found\n'

  const headers = Object.keys(rows[0])
  const escapeCsv = (val: unknown) => {
    if (val === null || val === undefined) return ''
    let raw = String(val)
    if (/^[=+\-@\t\r]/.test(raw)) {
      raw = `'${raw}`
    }
    const str = raw.replace(/"/g, '""')
    return `"${str}"`
  }

  const csvLines = [headers.join(',')]
  for (const row of rows) {
    csvLines.push(headers.map((h) => escapeCsv(row[h])).join(','))
  }
  return csvLines.join('\n') + '\n'
}

/* =========================================================================
   HEALTH METRICS & NOTIFICATIONS
========================================================================= */

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
    SELECT n.id, n.title, n.body, n.kind,
      CASE WHEN n.user_id IS NULL THEN nr.read_at ELSE n.read_at END AS readAt,
      n.created_at AS createdAt
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON nr.notification_id = n.id AND nr.user_id = ?
    WHERE n.user_id IS NULL OR n.user_id = ?
    ORDER BY n.created_at DESC LIMIT 50
  `).all(userId, userId) as Row[]
}

export function markNotificationRead(userId: string, notificationId: string) {
  const readAt = now()
  database.prepare(`
    INSERT INTO notification_reads (user_id, notification_id, read_at)
    SELECT ?, id, ? FROM notifications WHERE id = ? AND user_id IS NULL
    ON CONFLICT(user_id, notification_id) DO UPDATE SET read_at = excluded.read_at
  `).run(userId, readAt, notificationId)
  database.prepare(`UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`).run(readAt, notificationId, userId)
}

export function markAllNotificationsRead(userId: string) {
  const readAt = now()
  database.prepare(`
    INSERT INTO notification_reads (user_id, notification_id, read_at)
    SELECT ?, id, ? FROM notifications WHERE user_id IS NULL
    ON CONFLICT(user_id, notification_id) DO UPDATE SET read_at = excluded.read_at
  `).run(userId, readAt)
  database.prepare(`UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND user_id = ?`).run(readAt, userId)
}

/* =========================================================================
   SEED DATA & ENVIRONMENT PROVISIONING
========================================================================= */

function seedCoreData() {
  const seededPatients = [
    ['P-20391', 'Olivia Harris', 'Cardiology', 'Stable', '1988-04-12', 'Female', '+1 555-0192', 'A+', 'Penicillin'],
    ['P-19402', 'James Patel', 'Internal Medicine', 'New intake', '1975-09-23', 'Male', '+1 555-0144', 'B+', 'None'],
    ['P-18841', 'Maria Lopez', 'Surgery', 'Pre-op', '1992-11-05', 'Female', '+1 555-0188', 'O-', 'Latex'],
    ['P-17438', 'Robert Chen', 'Endocrinology', 'Follow-up', '1964-02-18', 'Male', '+1 555-0174', 'AB+', 'Sulfa'],
  ]
  for (const [patientId, name, department, status, dob, gender, phone, bloodGroup, allergies] of seededPatients) {
    database.prepare(`INSERT OR IGNORE INTO patients (id, name, department, status, dob, gender, phone, blood_group, allergies, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      patientId, name, department, status, dob, gender, phone, bloodGroup, allergies, now(),
    )
  }

  const appointments = [
    ['apt_0800', 'P-20391', 'Dr. Elena Ruiz', 'Cardiology', '2026-09-18T08:00:00.000Z', 'Room 301', 'Confirmed', 'Follow-up consultation for echocardiogram results'],
    ['apt_0830', 'P-19402', 'Dr. Marcus Lee', 'Internal Medicine', '2026-09-18T08:30:00.000Z', 'Room 204', 'Confirmed', 'Comprehensive physical and blood pressure check'],
    ['apt_0900', 'P-18841', 'Dr. Priya Shah', 'Surgery', '2026-09-18T09:00:00.000Z', 'Room 312', 'Pre-op', 'Pre-operative clearance for laparoscopic procedure'],
    ['apt_1030', 'P-17438', 'Dr. Marcus Lee', 'Endocrinology', '2026-09-18T10:30:00.000Z', 'Room 218', 'Confirmed', 'HbA1c quarterly review'],
  ]
  for (const appointment of appointments) {
    database.prepare(`INSERT OR IGNORE INTO appointments (id, patient_id, clinician_name, department, appointment_at, room, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(...appointment)
  }

  const beds = [
    ['bed_a101', 'Ward A · Cardiology', '101', 'Bed 1', 'Standard', 'Occupied'],
    ['bed_a102', 'Ward A · Cardiology', '101', 'Bed 2', 'Standard', 'Available'],
    ['bed_b201', 'Ward B · Surgery', '201', 'Bed 1', 'Standard', 'Occupied'],
    ['bed_b202', 'Ward B · Surgery', '201', 'Bed 2', 'Standard', 'Cleaning'],
    ['bed_c301', 'Ward C · Recovery', '301', 'Bed 1', 'Standard', 'Available'],
    ['bed_icu1', 'ICU · Critical Care', 'ICU-1', 'Bed 1', 'ICU', 'Occupied'],
    ['bed_icu2', 'ICU · Critical Care', 'ICU-2', 'Bed 2', 'ICU', 'Available'],
  ]
  for (const bed of beds) {
    database.prepare(`INSERT OR IGNORE INTO beds (id, ward, room_number, bed_number, bed_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(...bed, now())
  }

  const admissions = [
    ['adm_01', 'P-20391', 'bed_a101', 'Dr. Elena Ruiz', 'Arrhythmia monitoring', 'Admitted', '2026-09-15T14:00:00.000Z'],
    ['adm_02', 'P-18841', 'bed_b201', 'Dr. Priya Shah', 'Elective cholecystectomy preparation', 'Admitted', '2026-09-17T09:30:00.000Z'],
  ]
  for (const adm of admissions) {
    database.prepare(`INSERT OR IGNORE INTO admissions (id, patient_id, bed_id, admitting_doctor, diagnosis, status, admitted_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(...adm)
  }

  const emergencyCases = [
    ['ed_01', 'P-19402', 'James Patel', 49, 2, 'Chest pain radiating to left arm', 'BP 164/98, HR 104, SpO2 96%', 'Cardiac', 'In Treatment', '2026-09-18T07:42:00.000Z'],
    ['ed_02', null, 'John Doe #44', 35, 1, 'Motor vehicle collision, blunt trauma', 'BP 90/60, HR 128, SpO2 91%', 'Trauma', 'Triage', '2026-09-18T08:15:00.000Z'],
    ['ed_03', null, 'Eleanor Vance', 72, 3, 'Sudden unilateral facial droop, slurred speech', 'BP 150/90, HR 82, SpO2 98%', 'Stroke', 'In Treatment', '2026-09-18T08:30:00.000Z'],
  ]
  for (const edCase of emergencyCases) {
    database.prepare(`INSERT OR IGNORE INTO emergency_cases (id, patient_id, patient_name, age, triage_acuity, chief_complaint, vitals, assigned_team, status, arrival_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...edCase)
  }

  const medications = [
    ['med_amx', 'Amoxicillin 500mg', 'AMX-042', 'Antibiotics', 1240, 'capsules', 200, 12.50, 'In stock'],
    ['med_ins', 'Insulin Glargine 100U/ml', 'INS-117', 'Endocrine', 38, 'vials', 50, 85.00, 'Low stock'],
    ['med_atv', 'Atorvastatin 20mg', 'ATV-298', 'Cardiovascular', 486, 'tablets', 100, 18.00, 'In stock'],
    ['med_sal', 'Salbutamol Inhaler 100mcg', 'SAL-081', 'Respiratory', 180, 'inhalers', 50, 24.50, 'In stock'],
  ]
  for (const med of medications) {
    database.prepare(`INSERT OR IGNORE INTO medications (id, name, code, category, stock_quantity, unit, reorder_level, unit_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...med, now())
  }

  const prescriptions = [
    ['rx_01', 'P-20391', null, 'Dr. Elena Ruiz', 'med_atv', 'Atorvastatin 20mg', '20mg once daily at bedtime', 'Daily', '90 days', 'Active', '2026-09-01T10:00:00.000Z'],
    ['rx_02', 'P-17438', null, 'Dr. Marcus Lee', 'med_ins', 'Insulin Glargine 100U/ml', '24 units subcutaneous once daily', 'Daily', '30 days', 'Active', '2026-09-10T11:00:00.000Z'],
  ]
  for (const rx of prescriptions) {
    database.prepare(`INSERT OR IGNORE INTO prescriptions (id, patient_id, doctor_id, doctor_name, medication_id, medication_name, dosage, frequency, duration, status, prescribed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...rx)
  }

  const labs = [
    ['lab_01', 'P-20391', 'Olivia Harris', 'Dr. Elena Ruiz', 'Echocardiogram', 'Routine', 'Completed', 'LVEF 60%, normal chamber dimensions, mild mitral regurgitation', 'Normal EF 55-70%', 'Normal', '2026-09-10T09:00:00.000Z', '2026-09-11T14:30:00.000Z'],
    ['lab_02', 'P-19402', 'James Patel', 'Dr. Marcus Lee', 'Troponin I', 'Stat', 'In Progress', 'Processing serum assay', '< 0.04 ng/mL', null, '2026-09-18T07:50:00.000Z', null],
    ['lab_03', 'P-17438', 'Robert Chen', 'Dr. Marcus Lee', 'Lipid Panel', 'Routine', 'Completed', 'Total Chol 210 mg/dL, HDL 48 mg/dL, LDL 135 mg/dL, Triglycerides 160 mg/dL', 'LDL < 100 mg/dL', 'Abnormal', '2026-09-14T08:00:00.000Z', '2026-09-15T10:00:00.000Z'],
  ]
  for (const lab of labs) {
    database.prepare(`INSERT OR IGNORE INTO lab_orders (id, patient_id, patient_name, ordered_by_name, test_type, priority, status, result_summary, normal_range, interpretation, ordered_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...lab)
  }

  const invoices = [
    ['inv_01', 'P-20391', 'Olivia Harris', 'INV-849201', 'Cardiology outpatient consultation and echocardiography', 840.00, 600.00, 240.00, 'Pending', '2026-09-30', '2026-09-11T15:00:00.000Z'],
    ['inv_02', 'P-17438', 'Robert Chen', 'INV-731944', 'Endocrinology follow-up and biochemistry laboratory panel', 420.00, 420.00, 0.00, 'Paid', '2026-09-15', '2026-09-14T09:00:00.000Z'],
  ]
  for (const inv of invoices) {
    database.prepare(`INSERT OR IGNORE INTO billing_invoices (id, patient_id, patient_name, invoice_number, description, amount, insurance_coverage, patient_due, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...inv)
  }

  const clinicalNotes = [
    ['note_01', 'P-20391', null, 'Dr. Elena Ruiz', 'Progress Note', 'Patient reports mild dyspnea on exertion, denies chest pressure.', 'BP 128/82, HR 72, clear lung sounds bilaterally.', 'Stable NYHA Class I heart failure symptoms.', 'Continue current beta-blocker dosage, follow up in 3 months.', '2026-09-11T14:45:00.000Z'],
  ]
  for (const note of clinicalNotes) {
    database.prepare(`INSERT OR IGNORE INTO clinical_notes (id, patient_id, author_id, author_name, note_type, subjective, objective, assessment, plan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...note)
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
  const email = process.env[`MEDINEXUS_${prefix}_EMAIL`]?.trim()
  const password = process.env[`MEDINEXUS_${prefix}_PASSWORD`]
  if (!email && !password) return
  if (!email || !password) {
    throw new Error(`Set both MEDINEXUS_${prefix}_EMAIL and MEDINEXUS_${prefix}_PASSWORD to provision this account.`)
  }
  if (getUserByEmail(email)) return
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    throw new Error(`MEDINEXUS_${prefix}_EMAIL must be a valid email address.`)
  }
  if (password.length < 16) {
    throw new Error(`MEDINEXUS_${prefix}_PASSWORD must be at least 16 characters.`)
  }
  const name = process.env[`MEDINEXUS_${prefix}_NAME`] ?? prefix[0] + prefix.slice(1).toLowerCase()
  createUser({ email, name, password, role: prefix === 'ADMIN' ? 'Admin' : prefix === 'DOCTOR' ? 'Doctor' : 'Staff' })
}

if (demoDataEnabled) seedCoreData()
provisionUserFromEnvironment('ADMIN')
provisionUserFromEnvironment('DOCTOR')
provisionUserFromEnvironment('STAFF')
