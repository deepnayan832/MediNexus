import type { IncomingMessage, ServerResponse } from 'node:http'

export function sendJson(response: ServerResponse, status: number, payload: unknown, extraHeaders: Record<string, string> = {}) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders })
  response.end(JSON.stringify(payload))
}

export function sendError(response: ServerResponse, status: number, message: string, code: string) {
  sendJson(response, status, { error: { code, message } })
}

export async function readJson(request: IncomingMessage, maxBytes = 64 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('payload_too_large')
    chunks.push(buffer)
  }
  if (!chunks.length) return {}
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_json')
  return parsed as Record<string, unknown>
}

export function parseCookies(request: IncomingMessage) {
  const header = request.headers.cookie ?? ''
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    const separator = part.indexOf('=')
    if (separator === -1) return [[part, '']]
    try {
      return [[part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))]]
    } catch {
      return []
    }
  }))
}

const isProduction = process.env.NODE_ENV === 'production'
const sessionSameSite = isProduction ? 'None' : 'Lax'
const secureCookieAttribute = isProduction ? '; Secure' : ''

export function setSessionCookie(token: string) {
  const maxAge = 60 * 60 * 8
  return `medinexus_session=${encodeURIComponent(token)}; HttpOnly; SameSite=${sessionSameSite}; Path=/; Max-Age=${maxAge}${secureCookieAttribute}`
}

export function clearSessionCookie() {
  return `medinexus_session=; HttpOnly; SameSite=${sessionSameSite}; Path=/; Max-Age=0${secureCookieAttribute}`
}

export function asString(value: unknown, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

