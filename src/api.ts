export type ApiStatus = 'checking' | 'connected' | 'offline'

export type ApiUser = {
  id: string
  email: string
  name: string
  role: 'Admin' | 'Doctor' | 'Staff' | 'Patient'
  createdAt: string
}

export type RemoteHealthMetric = {
  id: string
  metricType: 'steps' | 'heart_rate' | 'sleep' | 'hydration' | 'blood_oxygen' | 'weight'
  value: number
  unit: string
  goalValue: number | null
  recordedAt: string
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
const API_TIMEOUT_MS = 10_000

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  const callerSignal = init.signal
  const abortFromCaller = () => controller.abort()
  callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  if (callerSignal?.aborted) controller.abort()

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted && !callerSignal?.aborted) {
      throw new Error('The MediNexus API did not respond within 10 seconds. Try again.')
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the MediNexus API. Check your connection and try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function checkApiHealth(signal?: AbortSignal) {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/health`, { signal, credentials: 'include' })
  if (!response.ok) throw new Error(`API health check failed with ${response.status}`)
  const health = await response.json().catch(() => null) as { service?: unknown; status?: unknown; database?: unknown; timestamp?: unknown } | null
  if (!health || typeof health !== 'object' || health.service !== 'medinexus-api' || typeof health.status !== 'string' || typeof health.database !== 'string' || typeof health.timestamp !== 'string') {
    throw new Error('The MediNexus API returned an invalid health response.')
  }
  if (health.status !== 'ok') throw new Error('MediNexus API is offline')
  return health as { service: string; status: string; database: string; timestamp: string }
}

type ApiEnvelope<T> = T | { error?: { message?: string } }

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetchWithTimeout(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload ? payload.error?.message : undefined
    throw new Error(message ?? `MediNexus API request failed with ${response.status}`)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('The MediNexus API returned an invalid response.')
  }
  return payload as T
}

function requireApiUser(user: unknown): ApiUser {
  if (!user || typeof user !== 'object'
    || !('id' in user) || typeof user.id !== 'string'
    || !('email' in user) || typeof user.email !== 'string'
    || !('name' in user) || typeof user.name !== 'string'
    || !('createdAt' in user) || typeof user.createdAt !== 'string'
    || !('role' in user) || !['Admin', 'Doctor', 'Staff', 'Patient'].includes(String(user.role))) {
    throw new Error('The MediNexus API returned an invalid account response.')
  }
  return user as ApiUser
}

export async function getCurrentUser() {
  const result = await request<{ user?: unknown }>('/api/auth/session')
  if (result.user === null) return null
  return requireApiUser(result.user)
}

export function login(email: string, password: string) {
  return request<{ user?: unknown }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then((result) => requireApiUser(result.user))
}

export function register(name: string, email: string, password: string) {
  return request<{ user?: unknown }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }).then((result) => requireApiUser(result.user))
}

export function logout() {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function getHealthMetrics() {
  return request<{ metrics?: unknown }>('/api/health-metrics').then((result) => {
    const metricTypes = ['steps', 'heart_rate', 'sleep', 'hydration', 'blood_oxygen', 'weight']
    if (!Array.isArray(result.metrics) || result.metrics.some((metric) => (
      !metric || typeof metric !== 'object'
      || !('id' in metric) || typeof metric.id !== 'string'
      || !('metricType' in metric) || !metricTypes.includes(String(metric.metricType))
      || !('value' in metric) || typeof metric.value !== 'number' || !Number.isFinite(metric.value)
      || !('unit' in metric) || typeof metric.unit !== 'string'
      || !('recordedAt' in metric) || typeof metric.recordedAt !== 'string'
    ))) throw new Error('The MediNexus API returned invalid health data.')
    return result.metrics as RemoteHealthMetric[]
  })
}

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

