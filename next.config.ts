import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const isCspEnforced = process.env.CSP_ENFORCE === "true" || (isProduction && process.env.CSP_REPORT_ONLY !== "true");
const cspHeaderKey = isCspEnforced
  ? "Content-Security-Policy"
  : "Content-Security-Policy-Report-Only";

// Never use unsafe-eval in production CSP.
// Development may allow unsafe-eval for source maps and hot reloading if needed.
const scriptSrc = isProduction
  ? "'self' 'unsafe-inline' https://*.clerk.accounts.dev https://*.clerk.com"
  : "'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com";

const cspDirective = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.clerk.accounts.dev https://*.clerk.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.pwnedpasswords.com",
  "worker-src 'self' blob:",
  "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com",
  "report-uri /api/security/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: cspHeaderKey, value: cspDirective },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
