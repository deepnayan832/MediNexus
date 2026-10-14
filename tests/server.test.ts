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
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  return { response, body }
}

before(async () => {
  databaseDirectory = await mkdtemp(join(tmpdir(), 'medinexus-test-'))
  const port = 8877 + Math.floor(Math.random() * 300)
  baseUrl = `http://127.0.0.1:${port}`
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
  server = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), MEDINEXUS_HOST: '127.0.0.1', MEDINEXUS_CORS_ORIGIN: 'http://127.0.0.1:5173', MEDINEXUS_DB_PATH: join(databaseDirectory, 'test.sqlite'), MEDINEXUS_TRUST_PROXY: 'true', MEDINEXUS_AUTH_ATTEMPTS_PER_MINUTE: '10', MEDINEXUS_DEMO_DATA: 'false' },
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
  assert.equal((me.body.user as Record<string, unknown>).role, 'Patient')
  const sessionProbe = await request('/api/auth/session', { headers: { Cookie: cookie } })
  assert.equal(sessionProbe.response.status, 200)

  const forbidden = await request('/api/patients', { headers: { Cookie: cookie } })
  assert.equal(forbidden.response.status, 403)

  const metrics = await request('/api/health-metrics', { headers: { Cookie: cookie } })
  assert.equal(metrics.response.status, 200)
  assert.deepEqual(metrics.body.metrics, [])
  const appointmentsBeforeBooking = await request('/api/appointments', { headers: { Cookie: cookie } })
  assert.equal(appointmentsBeforeBooking.response.status, 200)
  assert.deepEqual(appointmentsBeforeBooking.body.appointments, [])
  const appointmentAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const appointment = await request('/api/appointments', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ department: 'Cardiology', appointmentAt }),
  })
  assert.equal(appointment.response.status, 201)
  assert.equal((appointment.body.appointment as Record<string, unknown>).status, 'Requested')
  const appointmentsAfterBooking = await request('/api/appointments', { headers: { Cookie: cookie } })
  assert.equal(appointmentsAfterBooking.response.status, 200)
  assert.equal((appointmentsAfterBooking.body.appointments as unknown[]).length, 1)
  const pastAppointment = await request('/api/appointments', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ department: 'Cardiology', appointmentAt: '2020-01-01T10:00:00.000Z' }),
  })
  assert.equal(pastAppointment.response.status, 422)
  const unsupportedDepartment = await request('/api/appointments', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ department: 'Unlisted department', appointmentAt }),
  })
  assert.equal(unsupportedDepartment.response.status, 422)
  const created = await request('/api/health-metrics', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metricType: 'steps', value: 7120, unit: 'steps', goalValue: 8000 }),
  })
  assert.equal(created.response.status, 201)
  const createdMetric = created.body.metric as { id: string; value: number; unit: string }
  assert.equal(createdMetric.value, 7120)
  assert.equal(createdMetric.unit, 'steps')
  const savedMetrics = await request('/api/health-metrics', { headers: { Cookie: cookie } })
  assert.ok((savedMetrics.body.metrics as Array<{ id: string }>).some((metric) => metric.id === createdMetric.id))

  const invalidMetricUnit = await request('/api/health-metrics', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metricType: 'steps', value: 7120, unit: 'km' }),
  })
  assert.equal(invalidMetricUnit.response.status, 422)

  const logout = await request('/api/auth/logout', { method: 'POST', headers: { Cookie: cookie } })
  assert.equal(logout.response.status, 200)
  const afterLogout = await request('/api/auth/me', { headers: { Cookie: cookie } })
  assert.equal(afterLogout.response.status, 401)
  const emptySession = await request('/api/auth/session', { headers: { Cookie: cookie } })
  assert.equal(emptySession.response.status, 200)
  assert.equal(emptySession.body.user, null)
})

test('clears stale sessions when a user signs in again', async () => {
  const email = `relogin-${Date.now()}@example.test`
  const first = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Relogin User', email, password: 'SufficientlyLong!42' }),
  })
  assert.equal(first.response.status, 201)
  const firstCookie = (first.response.headers.get('set-cookie') ?? '').split(';')[0]

  const second = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SufficientlyLong!42' }),
  })
  assert.equal(second.response.status, 200)
  const secondCookie = (second.response.headers.get('set-cookie') ?? '').split(';')[0]
  assert.notEqual(firstCookie, secondCookie)

  const oldSessionStillWorks = await request('/api/auth/session', { headers: { Cookie: firstCookie } })
  assert.equal(oldSessionStillWorks.response.status, 200)
  assert.equal(oldSessionStillWorks.body.user, null)

  const currentSession = await request('/api/auth/session', { headers: { Cookie: secondCookie } })
  assert.equal(currentSession.response.status, 200)
  assert.ok(currentSession.body.user)
})

test('gives demo patients an upcoming appointment that appears in their appointment list', async () => {
  const demoDirectory = await mkdtemp(join(tmpdir(), 'medinexus-demo-test-'))
  const port = 10_000 + Math.floor(Math.random() * 300)
  const demoUrl = `http://127.0.0.1:${port}`
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const demoServer = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      MEDINEXUS_HOST: '127.0.0.1',
      MEDINEXUS_CORS_ORIGIN: 'http://127.0.0.1:5173',
      MEDINEXUS_DB_PATH: join(demoDirectory, 'demo.sqlite'),
      MEDINEXUS_DEMO_DATA: 'true',
    },
    stdio: 'ignore',
  })

  try {
    await waitForApi(demoUrl)
    const registration = await fetch(`${demoUrl}/api/auth/register`, {
      method: 'POST',
      headers: { Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Demo Patient', email: `demo-${Date.now()}@example.test`, password: 'SufficientlyLong!42' }),
    })
    assert.equal(registration.status, 201)
    const cookie = (registration.headers.get('set-cookie') ?? '').split(';')[0]
    const appointmentsResponse = await fetch(`${demoUrl}/api/appointments`, { headers: { Cookie: cookie } })
    assert.equal(appointmentsResponse.status, 200)
    const body = await appointmentsResponse.json() as { appointments: Array<{ appointmentAt: string }> }
    assert.ok(body.appointments.some((appointment) => Date.parse(appointment.appointmentAt) > Date.now()))
  } finally {
    if (demoServer.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(demoServer.pid), '/T', '/F'], { stdio: 'ignore' })
      else demoServer.kill()
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    await rm(demoDirectory, { recursive: true, force: true })
  }
})

test('rejects cross-origin writes', async () => {
  const response = await request('/api/auth/register', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Blocked User', email: 'blocked@example.test', password: 'SufficientlyLong!42' }),
  })
  assert.equal(response.response.status, 403)
  assert.equal((response.body.error as Record<string, unknown>).code, 'ORIGIN_REJECTED')
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

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await request('/api/auth/login', { method: 'POST', headers, body })
    assert.equal(result.response.status, 401)
  }

  const limited = await request('/api/auth/login', { method: 'POST', headers, body })
  assert.equal(limited.response.status, 429)
  assert.equal(limited.response.headers.get('retry-after'), '60')
  assert.equal((limited.body.error as Record<string, unknown>).code, 'RATE_LIMITED')
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
    const notifications = result.body.notifications as Array<{ id: string; readAt: string | null }>
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

test('rejects insecure additional CORS origins in production', () => {
  const tsxCli = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
  const result = spawnSync(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '0',
      MEDINEXUS_HOST: '127.0.0.1',
      MEDINEXUS_DB_PATH: join(databaseDirectory, 'insecure-cors.sqlite'),
      MEDINEXUS_PUBLIC_ORIGIN: 'https://medinexus.example.com',
      MEDINEXUS_CORS_ORIGINS: 'http://frontend.example.com',
      MEDINEXUS_DEMO_DATA: 'false',
    },
    encoding: 'utf8',
    timeout: 5000,
  })
  assert.notEqual(result.status, 0, 'production must refuse insecure additional CORS origins')
  assert.match((result.stderr || '') + (result.stdout || ''), /MEDINEXUS_CORS_ORIGINS must contain HTTPS origins/)
})
