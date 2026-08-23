import crypto from 'node:crypto';
import { getDbClient, ensureDatabaseSchema } from './db.js';

const SESSION_COOKIE_NAME = 'mea_session';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours

function getSessionSecret() {
  return process.env.SESSION_SECRET || 'mea_server_session_secret_2026_default_entropy_key_99881122';
}

function getBootstrapCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'marmin100'
  };
}

/**
 * Hash a password using PBKDF2 with SHA-256 and a per-hash salt
 */
export function hashPassword(password, salt = null) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 32, 'sha256').toString('hex');
  return { hash, salt: actualSalt };
}

/**
 * Verify a password against a stored hash and salt in constant time
 */
export function verifyPasswordHash(password, storedHash, storedSalt) {
  const { hash } = hashPassword(password, storedSalt);
  const bufA = Buffer.from(hash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify administrator credentials against server-side database or bootstrap config
 */
export async function verifyAdminCredentials(username, password) {
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return false;
  }

  await ensureDatabaseSchema();
  const client = getDbClient();
  const bootstrap = getBootstrapCredentials();

  // Check if a password override exists in the database
  try {
    const res = await client.execute('SELECT password_hash, salt FROM admin_credentials WHERE id = ?;', ['admin']);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      const usernameMatch = crypto.timingSafeEqual(
        Buffer.from(username),
        Buffer.from(bootstrap.username)
      );
      if (!usernameMatch) return false;
      return verifyPasswordHash(password, String(row.password_hash), String(row.salt));
    }
  } catch (err) {
    console.error('Error checking admin_credentials:', err);
  }

  // Fallback to bootstrap credentials with timing-safe comparison
  const userBufA = Buffer.from(username);
  const userBufB = Buffer.from(bootstrap.username);
  const passBufA = Buffer.from(password);
  const passBufB = Buffer.from(bootstrap.password);

  const isUserValid = userBufA.length === userBufB.length && crypto.timingSafeEqual(userBufA, userBufB);
  const isPassValid = passBufA.length === passBufB.length && crypto.timingSafeEqual(passBufA, passBufB);

  return isUserValid && isPassValid;
}

/**
 * Update the administrator password securely in the database
 */
export async function updateAdminPassword(newPassword) {
  await ensureDatabaseSchema();
  const client = getDbClient();
  const { hash, salt } = hashPassword(newPassword);
  const now = new Date().toISOString();

  await client.execute({
    sql: `INSERT INTO admin_credentials (id, password_hash, salt, updated_at)
          VALUES ('admin', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            password_hash = excluded.password_hash,
            salt = excluded.salt,
            updated_at = excluded.updated_at;`,
    args: [hash, salt, now]
  });

  // Invalidate all prior sessions
  await client.execute('DELETE FROM admin_sessions;');
}

/**
 * Create a new cryptographically signed session and store in database
 */
export async function createSession(userId = 'admin') {
  await ensureDatabaseSchema();
  const client = getDbClient();

  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_LIFETIME_MS);
  const lastSeenAt = now.toISOString();

  await client.execute({
    sql: `INSERT INTO admin_sessions (session_id, created_at, expires_at, last_seen_at, user_id)
          VALUES (?, ?, ?, ?, ?);`,
    args: [sessionId, now.toISOString(), expiresAt.toISOString(), lastSeenAt, userId]
  });

  // Sign token
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${sessionId}.${expiresAt.getTime()}`)
    .digest('hex');

  const tokenValue = `${sessionId}.${expiresAt.getTime()}.${signature}`;
  return { sessionId, tokenValue, expiresAt };
}

/**
 * Validate a session token against signature and database
 */
export async function validateSessionToken(tokenValue) {
  if (!tokenValue || typeof tokenValue !== 'string') return null;

  const parts = tokenValue.split('.');
  if (parts.length !== 3) return null;

  const [sessionId, expiresAtMsStr, signature] = parts;
  const expiresAtMs = parseInt(expiresAtMsStr, 10);
  if (isNaN(expiresAtMs) || Date.now() > expiresAtMs) return null;

  // Verify HMAC signature
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(`${sessionId}.${expiresAtMsStr}`)
    .digest('hex');

  const sigBufA = Buffer.from(signature);
  const sigBufB = Buffer.from(expectedSig);
  if (sigBufA.length !== sigBufB.length || !crypto.timingSafeEqual(sigBufA, sigBufB)) {
    return null;
  }

  await ensureDatabaseSchema();
  const client = getDbClient();

  const res = await client.execute({
    sql: 'SELECT session_id, created_at, expires_at, last_seen_at, user_id FROM admin_sessions WHERE session_id = ?;',
    args: [sessionId]
  });

  if (res.rows.length === 0) return null;
  const session = res.rows[0];

  const lastSeenTime = new Date(session.last_seen_at).getTime();
  if (Date.now() - lastSeenTime > IDLE_TIMEOUT_MS) {
    // Session timed out due to inactivity
    await client.execute({ sql: 'DELETE FROM admin_sessions WHERE session_id = ?;', args: [sessionId] });
    return null;
  }

  // Update sliding window
  const nowStr = new Date().toISOString();
  await client.execute({
    sql: 'UPDATE admin_sessions SET last_seen_at = ? WHERE session_id = ?;',
    args: [nowStr, sessionId]
  });

  return {
    sessionId: session.session_id,
    userId: session.user_id,
    createdAt: session.created_at
  };
}

/**
 * Invalidate a session
 */
export async function destroySession(sessionId) {
  if (!sessionId) return;
  try {
    await ensureDatabaseSchema();
    const client = getDbClient();
    await client.execute({ sql: 'DELETE FROM admin_sessions WHERE session_id = ?;', args: [sessionId] });
  } catch (err) {
    console.error('Error destroying session:', err);
  }
}

/**
 * Parse cookies from request
 */
export function parseCookies(req) {
  const cookieHeader = req.headers?.cookie || req.headers?.Cookie || '';
  const cookies = {};
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

/**
 * Set session cookie on response
 */
export function setSessionCookie(res, tokenValue, expiresAt) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(tokenValue)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.floor(ABSOLUTE_LIFETIME_MS / 1000)}`
  ];
  if (isProd) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

/**
 * Clear session cookie on response
 */
export function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const cookieParts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0'
  ];
  if (isProd) {
    cookieParts.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

/**
 * Express / Vercel Serverless Middleware: requireAdmin
 */
export async function requireAdmin(req, res) {
  // Validate CSRF / Origin for mutation requests
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers?.origin || req.headers?.Origin;
    const host = req.headers?.host || req.headers?.Host;
    if (origin && host) {
      try {
        const originHost = new URL(origin).host;
        if (originHost !== host) {
          res.status(403).json({ error: 'CSRF verification failed. Cross-origin mutations are forbidden.' });
          return null;
        }
      } catch {
        res.status(403).json({ error: 'Invalid origin header.' });
        return null;
      }
    }
  }

  const cookies = parseCookies(req);
  const tokenValue = cookies[SESSION_COOKIE_NAME];

  if (!tokenValue) {
    res.status(401).json({ error: 'Unauthorized. Administrator authentication required.' });
    return null;
  }

  const session = await validateSessionToken(tokenValue);
  if (!session) {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Session expired or invalid. Please authenticate again.' });
    return null;
  }

  req.adminSession = session;
  return session;
}
