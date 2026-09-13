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

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export async function checkApiHealth(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/health`, { signal, credentials: 'include' })
  if (!response.ok) throw new Error(`API health check failed with ${response.status}`)
  const health = await response.json() as { service: string; status: string; database: string; timestamp: string }
  if (health.status !== 'ok') throw new Error('MediNexus API is offline')
  return health
}

type ApiEnvelope<T> = T | { error?: { message?: string } }

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
  const payload = await response.json().catch(() => ({})) as ApiEnvelope<T>
  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload ? payload.error?.message : undefined
    throw new Error(message ?? `MediNexus API request failed with ${response.status}`)
  }
  return payload as T
}

export async function getCurrentUser() {
  const result = await request<{ user: ApiUser | null }>('/api/auth/session')
  return result.user
}

export function login(email: string, password: string) {
  return request<{ user: ApiUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then((result) => result.user)
}

export function register(name: string, email: string, password: string) {
  return request<{ user: ApiUser }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }).then((result) => result.user)
}

export function logout() {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' })
}

export function getHealthMetrics() {
  return request<{ metrics: RemoteHealthMetric[] }>('/api/health-metrics').then((result) => result.metrics)
}

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
