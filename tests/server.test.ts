import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

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
  const response = await fetch(`${baseUrl}${path}`, init)
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
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: String(port),
      MEDINEXUS_DB_PATH: join(databaseDirectory, 'test.sqlite'),
      MEDINEXUS_CORS_ORIGIN: 'https://frontend.example',
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
  const setCookie = registration.response.headers.get('set-cookie') ?? ''
  assert.match(setCookie, /HttpOnly/)
  assert.match(setCookie, /SameSite=None/)
  assert.match(setCookie, /Secure/)
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
  assert.equal(emptySession.body.user, null)
})

test('reports database readiness and applies the configured credentialed CORS allowlist', async () => {
  const health = await request('/api/health')
  assert.equal(health.response.status, 200)
  assert.equal(health.body.status, 'ok')
  assert.equal(health.body.database, 'connected')
  assert.equal(typeof health.body.timestamp, 'string')

  const allowed = await request('/api/health', { headers: { Origin: 'https://frontend.example' } })
  assert.equal(allowed.response.headers.get('access-control-allow-origin'), 'https://frontend.example')
  assert.equal(allowed.response.headers.get('access-control-allow-credentials'), 'true')

  const preflight = await request('/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://frontend.example',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  assert.equal(preflight.response.status, 204)
  assert.equal(preflight.response.headers.get('access-control-allow-origin'), 'https://frontend.example')

  const denied = await request('/api/health', { headers: { Origin: 'https://untrusted.example' } })
  assert.equal(denied.response.status, 403)
  assert.equal(denied.response.headers.get('access-control-allow-origin'), null)
})

test('rejects unsafe registration and malformed health metrics', async () => {
  const weak = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'bad', password: 'short' }),
  })
  assert.equal(weak.response.status, 422)

  const malformed = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"name":',
  })
  assert.equal(malformed.response.status, 400)
  assert.deepEqual(malformed.body.error, { code: 'BAD_REQUEST', message: 'The registration payload is invalid.' })

  const invalidLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown@example.test', password: 'wrong-but-long-password' }),
  })
  assert.equal(invalidLogin.response.status, 401)
  assert.deepEqual(invalidLogin.body.error, { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' })
})

