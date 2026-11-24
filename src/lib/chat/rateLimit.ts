// Simple in-memory sliding-window limiter.
// NOTE: on Vercel each serverless instance has its own memory, so this slows abuse
// but is not a hard guarantee. For strict limits, back it with Upstash Redis/Vercel KV.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    hits.forEach((times, k) => {
      if (!times.some((t) => now - t < windowMs)) hits.delete(k);
    });
  }
  return true;
}
