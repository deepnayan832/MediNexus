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
  return Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf('=')
    if (separator === -1) return [part, '']
    const name = part.slice(0, separator).trim()
    if (!name) return [part, '']
    let value = part.slice(separator + 1)
    try { value = decodeURIComponent(value) } catch { value = value.replace(/%[0-9A-Fa-f]{0,1}$/g, '') }
    return [name, value]
  }).filter(([name]) => Boolean(name)))
}

export function setSessionCookie(token: string, secure = process.env.NODE_ENV === 'production') {
  const maxAge = 60 * 60 * 8
  const secureAttribute = secure ? '; Secure' : ''
  return `medinexus_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureAttribute}`
}

export function clearSessionCookie(secure = process.env.NODE_ENV === 'production') {
  const secureAttribute = secure ? '; Secure' : ''
  return `medinexus_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureAttribute}`
}

export function asString(value: unknown, maxLength = 200) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

export function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}
