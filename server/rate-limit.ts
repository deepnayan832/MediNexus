export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, number[]>()

  constructor(private readonly maxBuckets = 10_000) {}

  allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
    const existing = this.buckets.get(key)
    const recent = (existing ?? []).filter((timestamp) => now - timestamp < windowMs)

    if (!existing && this.buckets.size >= this.maxBuckets) {
      for (const [candidate, timestamps] of this.buckets) {
        const latest = timestamps[timestamps.length - 1]
        if (latest === undefined || now - latest >= windowMs) this.buckets.delete(candidate)
      }
      // Never grow memory without bound if requests keep supplying new identities.
      if (!this.buckets.has(key) && this.buckets.size >= this.maxBuckets) return false
    }

    if (recent.length >= limit) {
      this.buckets.set(key, recent)
      return false
    }

    recent.push(now)
    this.buckets.set(key, recent)
    return true
  }
}
