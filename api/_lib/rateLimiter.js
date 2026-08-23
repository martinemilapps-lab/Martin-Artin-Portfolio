const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

// In-memory rate limiting map (IP -> { count, firstAttempt, lockedUntil })
const loginAttempts = new Map();

/**
 * Clean up expired rate limiting entries
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > WINDOW_MS && (!data.lockedUntil || now > data.lockedUntil)) {
      loginAttempts.delete(ip);
    }
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['X-Forwarded-For'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req?.socket?.remoteAddress || req?.connection?.remoteAddress || '127.0.0.1';
}

/**
 * Check if the request is rate-limited
 */
export function checkLoginRateLimit(req) {
  cleanupExpired();
  const ip = getClientIp(req);
  const now = Date.now();
  const data = loginAttempts.get(ip);

  if (!data) {
    return { isLimited: false, remainingAttempts: MAX_ATTEMPTS };
  }

  // Check if actively locked out
  if (data.lockedUntil && now < data.lockedUntil) {
    const remainingSeconds = Math.ceil((data.lockedUntil - now) / 1000);
    return {
      isLimited: true,
      remainingSeconds,
      remainingAttempts: 0,
      error: `Too many failed login attempts. Please wait ${remainingSeconds} second(s) before trying again.`
    };
  }

  // Check window expiry
  if (now - data.firstAttempt > WINDOW_MS) {
    loginAttempts.delete(ip);
    return { isLimited: false, remainingAttempts: MAX_ATTEMPTS };
  }

  if (data.count >= MAX_ATTEMPTS) {
    data.lockedUntil = now + LOCKOUT_MS;
    const remainingSeconds = Math.ceil(LOCKOUT_MS / 1000);
    return {
      isLimited: true,
      remainingSeconds,
      remainingAttempts: 0,
      error: `Security threshold exceeded. Temporary lockout for ${remainingSeconds} seconds.`
    };
  }

  return {
    isLimited: false,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - data.count)
  };
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  const data = loginAttempts.get(ip);

  if (!data || now - data.firstAttempt > WINDOW_MS) {
    loginAttempts.set(ip, {
      count: 1,
      firstAttempt: now,
      lockedUntil: null
    });
  } else {
    data.count += 1;
    if (data.count >= MAX_ATTEMPTS) {
      data.lockedUntil = now + LOCKOUT_MS;
    }
  }
}

/**
 * Reset rate limiting on successful login
 */
export function resetLoginRateLimit(req) {
  const ip = getClientIp(req);
  loginAttempts.delete(ip);
}
