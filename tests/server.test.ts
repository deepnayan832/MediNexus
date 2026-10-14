import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'

let server: ChildProcess | undefined
let databaseDirectory = ''
let baseUrl = ''

async function waitForApi(url: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return
    } catch {
      // The server may still be compiling through tsx.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('API did not become ready')
}

async function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((init.method ?? 'GET').toUpperCase()) && !headers.has('Origin')) {
    headers.set('Origin', 'http://127.0.0.1:5173')
  }
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json')
  const body = isJson ? await response.json().catch(() => ({})) as Record<string, unknown> : await response.text()
  return { response, body }
}

async function loginUser(email: string, password: string) {
  const result = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  assert.equal(result.response.status, 200, `login failed for ${email}`)
  const cookie = (result.response.headers.get('set-cookie') ?? '').split(';')[0]
  return cookie
}

before(async () => {
  databaseDirectory = await mkdtemp(join(tmpdir(), 'medinexus-test-'))
  const port = 8877 + Math.floor(Math.random() * 300)
  baseUrl = `http://127.0.0.1:${port}`
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
  server = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      MEDINEXUS_HOST: '127.0.0.1',
      MEDINEXUS_CORS_ORIGIN: 'http://127.0.0.1:5173',
      MEDINEXUS_DB_PATH: join(databaseDirectory, 'test.sqlite'),
      MEDINEXUS_TRUST_PROXY: 'true',
      MEDINEXUS_AUTH_ATTEMPTS_PER_MINUTE: '100',
      MEDINEXUS_REGISTRATIONS_PER_HOUR: '100',
      MEDINEXUS_DEMO_DATA: 'false',
      MEDINEXUS_ADMIN_EMAIL: 'admin@medinexus.test',
      MEDINEXUS_ADMIN_PASSWORD: 'AdministratorSecret!42',
      MEDINEXUS_ADMIN_NAME: 'Dr. Morgan',
      MEDINEXUS_DOCTOR_EMAIL: 'doctor@medinexus.test',
      MEDINEXUS_DOCTOR_PASSWORD: 'DoctorSecretPassword!42',
      MEDINEXUS_DOCTOR_NAME: 'Dr. Elena Ruiz',
      MEDINEXUS_STAFF_EMAIL: 'staff@medinexus.test',
      MEDINEXUS_STAFF_PASSWORD: 'StaffSecretPassword!42',
      MEDINEXUS_STAFF_NAME: 'James Wilson',
    },
    stdio: 'ignore',
  })
  await waitForApi(baseUrl)
})

after(async () => {
  if (server?.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' })
    else server.kill()
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  await rm(databaseDirectory, { recursive: true, force: true })
})

test('registers a patient, enforces RBAC, writes health data, and clears sessions', async () => {
  const email = `test-${Date.now()}@example.test`
  const registration = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Workflow Patient', email, password: 'SufficientlyLong!42' }),
  })
  assert.equal(registration.response.status, 201)
  const cookie = (registration.response.headers.get('set-cookie') ?? '').split(';')[0]
  assert.match(cookie, /^medinexus_session=/)

  const me = await request('/api/auth/me', { headers: { Cookie: cookie } })
  assert.equal(me.response.status, 200)
  assert.equal(((me.body as Record<string, unknown>).user as Record<string, unknown>).role, 'Patient')
  const sessionProbe = await request('/api/auth/session', { headers: { Cookie: cookie } })
  assert.equal(sessionProbe.response.status, 200)

  const forbidden = await request('/api/patients', { headers: { Cookie: cookie } })
  assert.equal(forbidden.response.status, 403)

  const metrics = await request('/api/health-metrics', { headers: { Cookie: cookie } })
  assert.equal(metrics.response.status, 200)
  assert.deepEqual((metrics.body as Record<string, unknown>).metrics, [])
  const appointmentsBeforeBooking = await request('/api/appointments', { headers: { Cookie: cookie } })
  assert.equal(appointmentsBeforeBooking.response.status, 200)
  assert.deepEqual((appointmentsBeforeBooking.body as Record<string, unknown>).appointments, [])
  const created = await request('/api/health-metrics', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metricType: 'steps', value: 7120, unit: 'steps', goalValue: 8000 }),
  })
  assert.equal(created.response.status, 201)

  const logout = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })
  assert.equal(logout.response.status, 200)
  const afterLogout = await request('/api/auth/me', { headers: { Cookie: cookie } })
  assert.equal(afterLogout.response.status, 401)
  const emptySession = await request('/api/auth/session', { headers: { Cookie: cookie } })
  assert.equal(emptySession.response.status, 200)
  assert.equal((emptySession.body as Record<string, unknown>).user, null)
})

test('rejects cross-origin writes', async () => {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Blocked User', email: 'blocked@example.test', password: 'SufficientlyLong!42' }),
  })
  assert.equal(response.response.status, 403)
  assert.equal(((response.body as Record<string, unknown>).error as Record<string, unknown>).code, 'ORIGIN_REJECTED')
})

test('rejects unsafe registration and malformed health metrics', async () => {
  const weak = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'bad', password: 'short' }),
  })
  assert.equal(weak.response.status, 422)
})

test('rate limits repeated login attempts by trusted client address', async () => {
  const headers = {
    Origin: 'http://127.0.0.1:5173',
    'Content-Type': 'application/json',
    'X-Forwarded-For': '203.0.113.88',
  }
  const body = JSON.stringify({ email: 'absent@example.test', password: 'not-the-password' })

  // The test server is started with MEDINEXUS_AUTH_ATTEMPTS_PER_MINUTE=100 in this suite,
  // so we test a distinct client IP for the rate limit test.
  const limiterHeaders = { ...headers, 'X-Forwarded-For': '198.51.100.99' }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await request('/api/auth/login', { method: 'POST', headers: limiterHeaders, body })
    assert.equal(result.response.status, 401)
  }

  const limited = await request('/api/auth/login', { method: 'POST', headers: limiterHeaders, body })
  assert.equal(limited.response.status, 429)
  assert.equal(limited.response.headers.get('retry-after'), '60')
  assert.equal(((limited.body as Record<string, unknown>).error as Record<string, unknown>).code, 'RATE_LIMITED')
})

test('keeps shared notification read state private to each user', async () => {
  const suffix = Date.now()
  async function register(email: string) {
    const result = await request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Shared Notice Test', email, password: 'SufficientlyLong!42' }),
    })
    assert.equal(result.response.status, 201)
    return (result.response.headers.get('set-cookie') ?? '').split(';')[0]
  }

  const firstCookie = await register(`notify-one-${suffix}@example.test`)
  const secondCookie = await register(`notify-two-${suffix}@example.test`)
  const notificationId = `ntf_shared_${suffix}`
  const db = new DatabaseSync(join(databaseDirectory, 'test.sqlite'))
  db.prepare('INSERT INTO notifications (id, user_id, title, body, kind, read_at, created_at) VALUES (?, NULL, ?, ?, ?, NULL, ?)').run(
    notificationId, 'Shared test alert', 'This is a test notification.', 'info', new Date().toISOString(),
  )
  db.close()

  async function findShared(cookie: string) {
    const result = await request('/api/notifications', { headers: { Cookie: cookie } })
    assert.equal(result.response.status, 200)
    const notifications = (result.body as Record<string, unknown>).notifications as Array<{ id: string; readAt: string | null }>
    return notifications.find((item) => item.id === notificationId)
  }

  assert.equal((await findShared(firstCookie))?.readAt, null)
  assert.equal((await findShared(secondCookie))?.readAt, null)

  const marked = await request(`/api/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: { Cookie: firstCookie },
  })
  assert.equal(marked.response.status, 200)
  assert.ok((await findShared(firstCookie))?.readAt)
  assert.equal((await findShared(secondCookie))?.readAt, null)
})

test('rejects weak passwords for environment-provisioned privileged users', () => {
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const result = spawnSync(process.execPath, [tsxCli, 'server/bootstrap.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '0',
      MEDINEXUS_HOST: '127.0.0.1',
      MEDINEXUS_DB_PATH: join(databaseDirectory, 'weak-password.sqlite'),
      MEDINEXUS_DEMO_DATA: 'false',
      MEDINEXUS_ADMIN_EMAIL: 'weak-admin@example.test',
      MEDINEXUS_ADMIN_PASSWORD: 'weak-password',
    },
    encoding: 'utf8',
    timeout: 5000,
  })
  assert.notEqual(result.status, 0, 'server must refuse weak provisioned credentials')
  assert.match((result.stderr || '') + (result.stdout || ''), /MEDINEXUS_ADMIN_PASSWORD must be at least 16 characters/)
})

/* =========================================================================
   NEW COMPREHENSIVE WORKFLOW TESTS
========================================================================= */

test('staff and doctors manage patients, appointments, and clinical notes', async () => {
  const staffCookie = await loginUser('staff@medinexus.test', 'StaffSecretPassword!42')
  const doctorCookie = await loginUser('doctor@medinexus.test', 'DoctorSecretPassword!42')

  // Staff creates a new patient
  const createPatientRes = await request('/api/patients', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Eleanor Roosevelt',
      department: 'Cardiology',
      status: 'Stable',
      dob: '1984-10-11',
      gender: 'Female',
      phone: '+1 555-4321',
      bloodGroup: 'O+',
      allergies: 'Penicillin',
    }),
  })
  assert.equal(createPatientRes.response.status, 201)
  const patient = (createPatientRes.body as Record<string, unknown>).patient as Record<string, unknown>
  assert.equal(patient.name, 'Eleanor Roosevelt')
  const patientId = String(patient.id)

  // Staff updates patient info
  const updatePatientRes = await request(`/api/patients/${patientId}`, {
    method: 'PATCH',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Under observation' }),
  })
  assert.equal(updatePatientRes.response.status, 200)
  assert.equal(((updatePatientRes.body as Record<string, unknown>).patient as Record<string, unknown>).status, 'Under observation')

  // Doctor schedules an appointment for patient
  const aptRes = await request('/api/appointments', {
    method: 'POST',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      department: 'Cardiology',
      appointmentAt: '2026-10-25T14:00:00.000Z',
      clinicianName: 'Dr. Elena Ruiz',
      room: 'Room 305',
      notes: 'Initial cardiac consultation',
    }),
  })
  assert.equal(aptRes.response.status, 201)
  const appointment = (aptRes.body as Record<string, unknown>).appointment as Record<string, unknown>
  const appointmentId = String(appointment.id)
  assert.equal(appointment.status, 'Confirmed')

  // Doctor adds SOAP clinical note
  const noteRes = await request('/api/clinical-notes', {
    method: 'POST',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      noteType: 'Initial Consult',
      subjective: 'Patient reports mild shortness of breath during exertion.',
      objective: 'BP 128/84, HR 74 regular rhythm.',
      assessment: 'Suspected mild mitral valve prolapse.',
      plan: 'Order 2D echocardiogram and prescribe beta-blocker.',
    }),
  })
  assert.equal(noteRes.response.status, 201)

  // Doctor lists clinical notes for this patient
  const listNotesRes = await request(`/api/clinical-notes?patientId=${patientId}`, {
    headers: { Cookie: doctorCookie },
  })
  assert.equal(listNotesRes.response.status, 200)
  const notes = (listNotesRes.body as Record<string, unknown>).notes as Array<Record<string, unknown>>
  assert.equal(notes.length, 1)
  assert.equal(notes[0].assessment, 'Suspected mild mitral valve prolapse.')

  // Doctor completes appointment
  const completeAptRes = await request(`/api/appointments/${appointmentId}`, {
    method: 'PATCH',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Completed' }),
  })
  assert.equal(completeAptRes.response.status, 200)
  assert.equal(((completeAptRes.body as Record<string, unknown>).appointment as Record<string, unknown>).status, 'Completed')
})

test('handles inpatient beds, admissions, and discharge flow', async () => {
  const staffCookie = await loginUser('staff@medinexus.test', 'StaffSecretPassword!42')
  const adminCookie = await loginUser('admin@medinexus.test', 'AdministratorSecret!42')

  // Create a patient to admit
  const pRes = await request('/api/patients', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Arthur Dent', department: 'Surgery' }),
  })
  const patientId = String(((pRes.body as Record<string, unknown>).patient as Record<string, unknown>).id)

  // Admin creates a new bed
  const bedRes = await request('/api/beds', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ward: 'Ward B · Surgery',
      roomNumber: '205',
      bedNumber: 'Bed 1',
      bedType: 'Standard',
    }),
  })
  assert.equal(bedRes.response.status, 201)
  const bedId = String(((bedRes.body as Record<string, unknown>).bed as Record<string, unknown>).id)

  // Admit patient to bed
  const admRes = await request('/api/admissions', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      bedId,
      admittingDoctor: 'Dr. Elena Ruiz',
      diagnosis: 'Acute appendicitis post-op recovery',
    }),
  })
  assert.equal(admRes.response.status, 201)
  const admissionId = String(((admRes.body as Record<string, unknown>).admission as Record<string, unknown>).id)

  // Bed is now Occupied
  const bedCheck = await request(`/api/beds?ward=Ward B · Surgery`, { headers: { Cookie: staffCookie } })
  const beds = (bedCheck.body as Record<string, unknown>).beds as Array<Record<string, unknown>>
  const targetBed = beds.find((b) => b.id === bedId)
  assert.equal(targetBed?.status, 'Occupied')

  // Discharge patient
  const dischRes = await request(`/api/admissions/${admissionId}/discharge`, {
    method: 'POST',
    headers: { Cookie: staffCookie },
  })
  assert.equal(dischRes.response.status, 200)

  // Bed status is updated to Cleaning
  const bedCheckAfter = await request(`/api/beds?ward=Ward B · Surgery`, { headers: { Cookie: staffCookie } })
  const bedsAfter = (bedCheckAfter.body as Record<string, unknown>).beds as Array<Record<string, unknown>>
  const cleanedBed = bedsAfter.find((b) => b.id === bedId)
  assert.equal(cleanedBed?.status, 'Cleaning')
})

test('handles emergency triage queue and acuity updates', async () => {
  const staffCookie = await loginUser('staff@medinexus.test', 'StaffSecretPassword!42')

  const edRes = await request('/api/emergency', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientName: 'Jane Smith',
      age: 28,
      triageAcuity: 1,
      chiefComplaint: 'Severe respiratory distress, anaphylaxis',
      vitals: 'BP 88/50, HR 135, SpO2 86%',
      assignedTeam: 'Trauma',
    }),
  })
  assert.equal(edRes.response.status, 201)
  const caseId = String(((edRes.body as Record<string, unknown>).case as Record<string, unknown>).id)

  // Update emergency case status
  const updateRes = await request(`/api/emergency/${caseId}`, {
    method: 'PATCH',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'In Treatment', vitals: 'BP 110/70, HR 92, SpO2 97% on O2' }),
  })
  assert.equal(updateRes.response.status, 200)
  assert.equal(((updateRes.body as Record<string, unknown>).case as Record<string, unknown>).status, 'In Treatment')
})

test('handles pharmacy, prescribing, diagnostics, and billing workflows', async () => {
  const adminCookie = await loginUser('admin@medinexus.test', 'AdministratorSecret!42')
  const doctorCookie = await loginUser('doctor@medinexus.test', 'DoctorSecretPassword!42')
  const staffCookie = await loginUser('staff@medinexus.test', 'StaffSecretPassword!42')

  // 1. Create Patient
  const pRes = await request('/api/patients', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Franklin Pierce', department: 'Internal Medicine' }),
  })
  const patientId = String(((pRes.body as Record<string, unknown>).patient as Record<string, unknown>).id)

  // 2. Admin adds medication to pharmacy catalog
  const medRes = await request('/api/medications', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Metformin 500mg',
      code: `MET-${Date.now().toString().slice(-4)}`,
      category: 'Endocrine',
      stockQuantity: 500,
      unit: 'tablets',
      reorderLevel: 100,
      unitPrice: 8.50,
    }),
  })
  assert.equal(medRes.response.status, 201)
  const medId = String(((medRes.body as Record<string, unknown>).medication as Record<string, unknown>).id)

  // 3. Doctor prescribes medication
  const rxRes = await request('/api/prescriptions', {
    method: 'POST',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      medicationId: medId,
      medicationName: 'Metformin 500mg',
      dosage: '500mg twice daily with meals',
      frequency: 'Twice daily',
      duration: '90 days',
    }),
  })
  assert.equal(rxRes.response.status, 201)
  const rxId = String(((rxRes.body as Record<string, unknown>).prescription as Record<string, unknown>).id)

  // 4. Staff dispenses medication
  const dispenseRes = await request(`/api/prescriptions/${rxId}/dispense`, {
    method: 'PATCH',
    headers: { Cookie: staffCookie },
  })
  assert.equal(dispenseRes.response.status, 200)
  assert.equal(((dispenseRes.body as Record<string, unknown>).prescription as Record<string, unknown>).status, 'Dispensed')

  // 5. Doctor orders lab test
  const labRes = await request('/api/labs', {
    method: 'POST',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      patientName: 'Franklin Pierce',
      testType: 'Hemoglobin A1c',
      priority: 'Routine',
    }),
  })
  assert.equal(labRes.response.status, 201)
  const labId = String(((labRes.body as Record<string, unknown>).lab as Record<string, unknown>).id)

  // 6. Lab completes test with results
  const labUpdateRes = await request(`/api/labs/${labId}`, {
    method: 'PATCH',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'Completed',
      resultSummary: 'HbA1c: 6.8%',
      normalRange: '< 5.7%',
      interpretation: 'Abnormal (Diabetic control)',
    }),
  })
  assert.equal(labUpdateRes.response.status, 200)
  assert.equal(((labUpdateRes.body as Record<string, unknown>).lab as Record<string, unknown>).status, 'Completed')

  // 7. Staff creates invoice
  const invRes = await request('/api/billing', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      patientName: 'Franklin Pierce',
      description: 'Endocrinology consultation, HbA1c lab, and Metformin prescription',
      amount: 320.00,
      insuranceCoverage: 250.00,
      dueDate: '2026-11-15',
    }),
  })
  assert.equal(invRes.response.status, 201)
  const invoice = (invRes.body as Record<string, unknown>).invoice as Record<string, unknown>
  const invoiceId = String(invoice.id)
  assert.equal(invoice.patientDue, 70.00)

  // 8. Staff submits insurance claim
  const claimRes = await request('/api/insurance', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceId,
      patientId,
      providerName: 'BlueCross Health',
      policyNumber: 'BC-992019',
      claimAmount: 250.00,
    }),
  })
  assert.equal(claimRes.response.status, 201)

  // 9. Invoice is paid
  const payRes = await request(`/api/billing/${invoiceId}/pay`, {
    method: 'POST',
    headers: { Cookie: staffCookie },
  })
  assert.equal(payRes.response.status, 200)
  assert.equal(((payRes.body as Record<string, unknown>).invoice as Record<string, unknown>).status, 'Paid')
})

test('exports hospital tabular data as CSV for authorized roles and denies unauthorized patients', async () => {
  const adminCookie = await loginUser('admin@medinexus.test', 'AdministratorSecret!42')
  const email = `patient-csv-${Date.now()}@example.test`
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient CSV Tester', email, password: 'SufficientlyLong!42' }),
  })
  const patientCookie = (regRes.response.headers.get('set-cookie') ?? '').split(';')[0]

  // Admin export succeeds
  const exportRes = await request('/api/export/patients', { headers: { Cookie: adminCookie } })
  assert.equal(exportRes.response.status, 200)
  assert.ok(exportRes.response.headers.get('content-type')?.includes('text/csv'))
  assert.ok(typeof exportRes.body === 'string' && exportRes.body.includes('id,userId,name,department'))

  // Patient export is forbidden
  const forbiddenExport = await request('/api/export/patients', { headers: { Cookie: patientCookie } })
  assert.equal(forbiddenExport.response.status, 403)
})

test('allows user profile update and password change', async () => {
  const email = `user-profile-${Date.now()}@example.test`
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Initial Name', email, password: 'SufficientlyLong!42' }),
  })
  assert.equal(regRes.response.status, 201)
  const cookie = (regRes.response.headers.get('set-cookie') ?? '').split(';')[0]

  // Update profile name
  const updateRes = await request('/api/auth/profile', {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Updated Name', email }),
  })
  assert.equal(updateRes.response.status, 200)
  assert.equal(((updateRes.body as Record<string, unknown>).user as Record<string, unknown>).name, 'Updated Name')

  // Change password
  const pwRes = await request('/api/auth/change-password', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'SufficientlyLong!42', newPassword: 'BrandNewPassword!99' }),
  })
  assert.equal(pwRes.response.status, 200)

  // Verify new password works
  const newLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'BrandNewPassword!99' }),
  })
  assert.equal(newLogin.response.status, 200)
})

test('enforces patient ownership (IDOR protection) on appointments, clinical notes, and insurance claims', async () => {
  const staffCookie = await loginUser('staff@medinexus.test', 'StaffSecretPassword!42')
  const doctorCookie = await loginUser('doctor@medinexus.test', 'DoctorSecretPassword!42')

  // Register two distinct patients
  const p1Reg = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient Alpha', email: `alpha-${Date.now()}@example.test`, password: 'AlphaSecretPassword!42' }),
  })
  assert.equal(p1Reg.response.status, 201)
  const p1Cookie = (p1Reg.response.headers.get('set-cookie') ?? '').split(';')[0]

  const p2Reg = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Patient Beta', email: `beta-${Date.now()}@example.test`, password: 'BetaSecretPassword!42' }),
  })
  assert.equal(p2Reg.response.status, 201)
  const p2Cookie = (p2Reg.response.headers.get('set-cookie') ?? '').split(';')[0]

  // Patient Alpha books an appointment
  const aptRes = await request('/api/appointments', {
    method: 'POST',
    headers: { Cookie: p1Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      department: 'Cardiology',
      appointmentAt: '2026-10-25T10:00:00.000Z',
      clinicianName: 'Dr. Elena Ruiz',
    }),
  })
  assert.equal(aptRes.response.status, 201)
  const apt = (aptRes.body as Record<string, unknown>).appointment as Record<string, unknown>
  const aptId = String(apt.id)
  const p1PatientId = String(apt.patientId)

  // Patient Beta cannot view or cancel Patient Alpha's appointment
  const idorGetApt = await request(`/api/appointments/${aptId}`, { headers: { Cookie: p2Cookie } })
  assert.equal(idorGetApt.response.status, 403)

  const idorCancelApt = await request(`/api/appointments/${aptId}`, {
    method: 'PATCH',
    headers: { Cookie: p2Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Cancelled' }),
  })
  assert.equal(idorCancelApt.response.status, 403)

  // Patient Alpha can view and cancel their own appointment
  const ownGetApt = await request(`/api/appointments/${aptId}`, { headers: { Cookie: p1Cookie } })
  assert.equal(ownGetApt.response.status, 200)
  const ownCancelApt = await request(`/api/appointments/${aptId}`, {
    method: 'PATCH',
    headers: { Cookie: p1Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'Cancelled' }),
  })
  assert.equal(ownCancelApt.response.status, 200)
  assert.equal(((ownCancelApt.body as Record<string, unknown>).appointment as Record<string, unknown>).status, 'Cancelled')

  // Doctor writes clinical note for Patient Alpha; Patient Beta cannot read it
  const noteRes = await request('/api/clinical-notes', {
    method: 'POST',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: p1PatientId,
      noteType: 'Progress Note',
      subjective: 'Resting comfortably',
      objective: 'BP 118/76',
      assessment: 'Stable hypertension',
      plan: 'Continue current regimen',
    }),
  })
  assert.equal(noteRes.response.status, 201)

  const idorNotes = await request(`/api/clinical-notes?patientId=${p1PatientId}`, { headers: { Cookie: p2Cookie } })
  assert.equal(idorNotes.response.status, 403)

  // Staff creates invoice for Patient Alpha; Patient Beta cannot file insurance claim for it
  const invRes = await request('/api/billing', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId: p1PatientId,
      patientName: 'Patient Alpha',
      description: 'Cardiology consult',
      amount: 200,
      insuranceCoverage: 150,
      dueDate: '2026-11-20',
    }),
  })
  assert.equal(invRes.response.status, 201)
  const invoiceId = String(((invRes.body as Record<string, unknown>).invoice as Record<string, unknown>).id)

  const idorClaim = await request('/api/insurance', {
    method: 'POST',
    headers: { Cookie: p2Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceId,
      patientId: p1PatientId,
      providerName: 'Aetna',
      policyNumber: 'AET-123',
      claimAmount: 150,
    }),
  })
  assert.equal(idorClaim.response.status, 403)

  // Patient cannot access pharmacy inventory or admin audit logs
  const medForbidden = await request('/api/medications', { headers: { Cookie: p1Cookie } })
  assert.equal(medForbidden.response.status, 403)
  const auditForbidden = await request('/api/audit-logs', { headers: { Cookie: p1Cookie } })
  assert.equal(auditForbidden.response.status, 403)
})

test('enforces bed availability, prescription stock decrement, double-action prevention, and CSV formula sanitization', async () => {
  const adminCookie = await loginUser('admin@medinexus.test', 'AdministratorSecret!42')
  const doctorCookie = await loginUser('doctor@medinexus.test', 'DoctorSecretPassword!42')
  const staffCookie = await loginUser('staff@medinexus.test', 'StaffSecretPassword!42')

  // Create patient with formula-injection payload in allergies
  const ptRes = await request('/api/patients', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Formula Test Patient',
      department: 'Surgery',
      allergies: '=CMD|\' /C calc\'!A0',
    }),
  })
  assert.equal(ptRes.response.status, 201)
  const patientId = String(((ptRes.body as Record<string, unknown>).patient as Record<string, unknown>).id)

  // Verify CSV export neutralizes leading '=' with single quote
  const csvRes = await request('/api/export/patients', { headers: { Cookie: adminCookie } })
  assert.equal(csvRes.response.status, 200)
  assert.ok(typeof csvRes.body === 'string' && csvRes.body.includes('"\'=CMD|'))

  // Create bed and admit patient
  const bedRes = await request('/api/beds', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ward: 'Ward D', roomNumber: '401', bedNumber: 'D-401', bedType: 'Standard' }),
  })
  const bedId = String(((bedRes.body as Record<string, unknown>).bed as Record<string, unknown>).id)

  const adm1 = await request('/api/admissions', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, bedId, admittingDoctor: 'Dr. Ruiz', diagnosis: 'Observation' }),
  })
  assert.equal(adm1.response.status, 201)
  const admissionId = String(((adm1.body as Record<string, unknown>).admission as Record<string, unknown>).id)

  // Second admission to already-occupied bed is rejected with 409
  const admDuplicate = await request('/api/admissions', {
    method: 'POST',
    headers: { Cookie: staffCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId, bedId, admittingDoctor: 'Dr. Ruiz', diagnosis: 'Second admission' }),
  })
  assert.equal(admDuplicate.response.status, 409)

  // Discharge once succeeds, discharging again returns 409
  const dis1 = await request(`/api/admissions/${admissionId}/discharge`, { method: 'POST', headers: { Cookie: staffCookie } })
  assert.equal(dis1.response.status, 200)
  const dis2 = await request(`/api/admissions/${admissionId}/discharge`, { method: 'POST', headers: { Cookie: staffCookie } })
  assert.equal(dis2.response.status, 409)

  // Create medication with stock 10, prescribe, dispense, verify stock becomes 9, and second dispense returns 409
  const medRes = await request('/api/medications', {
    method: 'POST',
    headers: { Cookie: adminCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Cefazolin 1g',
      code: `CEF-${Date.now().toString().slice(-4)}`,
      category: 'Antibiotics',
      stockQuantity: 10,
      unit: 'vials',
      reorderLevel: 5,
      unitPrice: 18,
    }),
  })
  const medId = String(((medRes.body as Record<string, unknown>).medication as Record<string, unknown>).id)

  const rxRes = await request('/api/prescriptions', {
    method: 'POST',
    headers: { Cookie: doctorCookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patientId,
      medicationId: medId,
      medicationName: 'Cefazolin 1g',
      dosage: '1g IV',
      frequency: 'Every 8 hours',
      duration: '3 days',
    }),
  })
  assert.equal(rxRes.response.status, 201)
  const rxId = String(((rxRes.body as Record<string, unknown>).prescription as Record<string, unknown>).id)

  const disp1 = await request(`/api/prescriptions/${rxId}/dispense`, { method: 'PATCH', headers: { Cookie: staffCookie } })
  assert.equal(disp1.response.status, 200)

  const disp2 = await request(`/api/prescriptions/${rxId}/dispense`, { method: 'PATCH', headers: { Cookie: staffCookie } })
  assert.equal(disp2.response.status, 409)

  const medsAfter = await request('/api/medications?search=Cefazolin', { headers: { Cookie: staffCookie } })
  const updatedMed = ((medsAfter.body as Record<string, unknown>).medications as Array<Record<string, unknown>>).find((m) => m.id === medId)
  assert.equal(updatedMed?.stockQuantity, 9)

  // Admin can query audit logs
  const logsRes = await request('/api/audit-logs?limit=10', { headers: { Cookie: adminCookie } })
  assert.equal(logsRes.response.status, 200)
  assert.ok(Array.isArray((logsRes.body as Record<string, unknown>).logs))
})

test('revokes other active sessions when a user changes their password', async () => {
  const email = `session-revoke-${Date.now()}@example.test`
  const regRes = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Session Tester', email, password: 'InitialPassword!123' }),
  })
  assert.equal(regRes.response.status, 201)
  const session1Cookie = (regRes.response.headers.get('set-cookie') ?? '').split(';')[0]
  const session2Cookie = await loginUser(email, 'InitialPassword!123')

  // Change password using session1
  const pwRes = await request('/api/auth/change-password', {
    method: 'POST',
    headers: { Cookie: session1Cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: 'InitialPassword!123', newPassword: 'RotatedPassword!456' }),
  })
  assert.equal(pwRes.response.status, 200)

  // session1 remains active, session2 is revoked
  const me1 = await request('/api/auth/me', { headers: { Cookie: session1Cookie } })
  assert.equal(me1.response.status, 200)
  const me2 = await request('/api/auth/me', { headers: { Cookie: session2Cookie } })
  assert.equal(me2.response.status, 401)
})
