/**
 * Client-Side RFC 6238 TOTP (Time-Based One-Time Password) implementation.
 *
 * Designed according to RFC 6238 and RFC 4226 using the browser Web Crypto API.
 * Uses integer-safe 64-bit Big-Endian counter buffers working beyond the 32-bit Unix boundary.
 */

export type TotpAlgorithm = "SHA-1" | "SHA-256" | "SHA-512";

export type TotpConfig = {
  secret: string; // Base32 encoded
  issuer?: string;
  account?: string;
  algorithm?: TotpAlgorithm;
  digits?: number; // 6 or 8 (default 6)
  period?: number; // default 30 seconds
};

export type TotpTimeRemaining = {
  remainingSeconds: number;
  period: number;
  percentage: number;
};

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decode an RFC 4648 Base32 string into raw bytes.
 * Ignores spaces, hyphens, and padding '=' characters. Case-insensitive.
 */
export function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (clean.length === 0) return new Uint8Array(0);

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character: "${char}"`);
    }

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

/**
 * Encode raw bytes to RFC 4648 Base32 without padding.
 */
export function bytesToBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i += 1) {
    value = (value << 8) | bytes[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Build 8-byte big-endian counter buffer safe beyond the 32-bit integer boundary.
 */
function createCounterBuffer(counter: number): ArrayBuffer {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  // Separate into 32-bit high and low words (safe up to 2^53 - 1)
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);
  return buffer;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/**
 * Generate an RFC 6238 TOTP code using Web Crypto HMAC.
 */
export async function generateTotpCode(
  config: TotpConfig,
  currentTimestampMs = Date.now()
): Promise<string> {
  const secretBytes = base32ToBytes(config.secret);
  if (secretBytes.byteLength === 0) {
    throw new Error("TOTP secret cannot be empty");
  }

  const period = config.period && config.period > 0 ? config.period : 30;
  const digits = config.digits === 8 ? 8 : 6;
  const algorithm: TotpAlgorithm = config.algorithm ?? "SHA-1";

  // RFC 6238: T = Math.floor(currentUnixTime / period)
  const currentSeconds = Math.floor(currentTimestampMs / 1000);
  const counter = Math.floor(currentSeconds / period);
  const counterBuffer = createCounterBuffer(counter);

  // Import HMAC key using Web Crypto Subtle API
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secretBytes),
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"]
  );

  // Compute HMAC digest
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBuffer);
  const hashBytes = new Uint8Array(signature);

  // RFC 4226 Dynamic Truncation
  const offset = hashBytes[hashBytes.length - 1] & 0x0f;
  const binary =
    ((hashBytes[offset] & 0x7f) << 24) |
    ((hashBytes[offset + 1] & 0xff) << 16) |
    ((hashBytes[offset + 2] & 0xff) << 8) |
    (hashBytes[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, "0");
}

/**
 * Format TOTP code with standard separator for human readability (e.g., '123 456').
 */
export function formatTotpDisplay(code: string): string {
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

/**
 * Calculate seconds remaining in the current time step and cycle progress percentage.
 */
export function getTotpTimeRemaining(
  period = 30,
  currentTimestampMs = Date.now()
): TotpTimeRemaining {
  const currentSeconds = Math.floor(currentTimestampMs / 1000);
  const elapsedInStep = currentSeconds % period;
  const remainingSeconds = period - elapsedInStep;
  const percentage = Math.round((remainingSeconds / period) * 100);

  return {
    remainingSeconds,
    period,
    percentage,
  };
}

/**
 * Parse an otpauth://totp/ provisioning URI according to Key Uri Format.
 * Strictly validates URI scheme, secret, algorithm, and parameters.
 */
export function parseTotpUri(uriString: string): TotpConfig {
  const trimmed = uriString.trim();
  if (!trimmed.toLowerCase().startsWith("otpauth://totp/")) {
    throw new Error("Invalid TOTP URI: must start with otpauth://totp/");
  }

  // Parse URL safely
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Malformed TOTP URI");
  }

  const secretParam = url.searchParams.get("secret");
  if (!secretParam) {
    throw new Error("Missing 'secret' parameter in TOTP URI");
  }

  // Validate base32
  const secret = secretParam.replace(/\s+/g, "").toUpperCase();
  try {
    const bytes = base32ToBytes(secret);
    if (bytes.length < 4) throw new Error("Secret too short");
  } catch (err) {
    throw new Error(`Invalid Base32 secret: ${err instanceof Error ? err.message : "decode error"}`);
  }

  // Path label: e.g. /totp/Example:alice@gmail.com or /totp/alice@gmail.com
  const label = decodeURIComponent(url.pathname.replace(/^\/totp\/?/i, "")).trim();
  let issuer = url.searchParams.get("issuer")?.trim();
  let account = label;

  if (label.includes(":")) {
    const parts = label.split(":");
    const labelIssuer = parts[0]?.trim();
    account = parts.slice(1).join(":").trim();
    if (!issuer && labelIssuer) {
      issuer = labelIssuer;
    }
  }

  // Algorithm
  const algoParam = url.searchParams.get("algorithm")?.toUpperCase() ?? "SHA1";
  let algorithm: TotpAlgorithm = "SHA-1";
  if (algoParam === "SHA256" || algoParam === "SHA-256") {
    algorithm = "SHA-256";
  } else if (algoParam === "SHA512" || algoParam === "SHA-512") {
    algorithm = "SHA-512";
  } else if (algoParam !== "SHA1" && algoParam !== "SHA-1") {
    throw new Error(`Unsupported TOTP algorithm: ${algoParam}`);
  }

  // Digits
  const digitsParam = url.searchParams.get("digits");
  let digits = 6;
  if (digitsParam) {
    const parsedDigits = Number(digitsParam);
    if (parsedDigits === 8) digits = 8;
    else if (parsedDigits !== 6) {
      throw new Error("Only 6 or 8 digits are supported for TOTP");
    }
  }

  // Period
  const periodParam = url.searchParams.get("period");
  let period = 30;
  if (periodParam) {
    const parsedPeriod = Number(periodParam);
    if (!Number.isInteger(parsedPeriod) || parsedPeriod < 5 || parsedPeriod > 300) {
      throw new Error("Period must be an integer between 5 and 300 seconds");
    }
    period = parsedPeriod;
  }

  return {
    secret,
    issuer: issuer || undefined,
    account: account || undefined,
    algorithm,
    digits,
    period,
  };
}
