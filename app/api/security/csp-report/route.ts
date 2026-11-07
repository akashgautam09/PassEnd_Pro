import { enforceRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  const limited = await enforceRateLimit(`csp-report:${clientIp}`, 60, 60_000);
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16 * 1024) return new Response(null, { status: 413 });

  const body = await request.text();
  if (process.env.NODE_ENV !== "production" && body) {
    try {
      const parsed = JSON.parse(body) as unknown;
      console.warn("[CSP-Report]", JSON.stringify(parsed));
    } catch {
      // ignore non-json csp report bodies
    }
  }

  return new Response(null, { status: 204 });
}
