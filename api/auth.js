// Minimal auth for the admin page. Deliberately small: a shared password
// (from the ADMIN_PASSWORD env var) exchanged for a short-lived signed token.
// No user accounts, no session store — just enough to gate writes on a
// self-hosted instance.
//
// SECURITY NOTES (see README):
//   - If ADMIN_PASSWORD is unset, admin is DISABLED (fail-shut). Read stays open.
//   - Password compare is constant-time (no timing oracle).
//   - Tokens are HMAC-signed with a per-process secret and expire (default 12h).
//   - This is NOT TLS. Over plain HTTP the password and token cross the wire in
//     the clear. If exposed beyond localhost, run behind an HTTPS reverse proxy.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const PASSWORD = process.env.ADMIN_PASSWORD || '';
export const ADMIN_ENABLED = PASSWORD.length > 0;

// Per-process signing secret. Tokens don't survive a restart — acceptable for v0.2.
const SECRET = process.env.ADMIN_TOKEN_SECRET || randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  // timingSafeEqual requires equal length; length itself isn't secret here,
  // but we still avoid an early-return branch on the password contents.
  if (ba.length !== bb.length) {
    // Compare against a same-length dummy so timing doesn't reveal length match.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function checkPassword(candidate) {
  if (!ADMIN_ENABLED) return false;
  return constantTimeEqual(candidate ?? '', PASSWORD);
}

export function issueToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${exp}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!ADMIN_ENABLED || !token || typeof token !== 'string') return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  // constant-time signature check
  const sb = Buffer.from(sig), eb = Buffer.from(expected);
  if (sb.length !== eb.length || !timingSafeEqual(sb, eb)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}

export function bearerFrom(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}
