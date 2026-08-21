/**
 * SECURITY UTILITIES & CRYPTOGRAPHIC ENGINE
 * Implements high-security considerations:
 * - Constant-time comparisons (mitigating timing attacks)
 * - Web Crypto SHA-256 salted password/token hashing
 * - High-entropy session token generation
 * - Parameterized access link token validation
 * - Progressive rate limiting & lockout defense
 * - Input sanitization & safe URL verification (XSS prevention)
 * - Safe file validation & SVG sanitization
 */

import { 
  fetchSecurityConfigFromTurso, 
  saveSecurityConfigToTurso 
} from '../services/tursoService';

// Default Salt used for local hash derivation
const DEFAULT_SALT = 'MEA_ARTEEN_SECURE_SALT_v2026_x89';

// Default Master Passkey Hash (SHA-256 of "Arteen@2026!Admin" with DEFAULT_SALT)
// Computed as: SHA-256(DEFAULT_SALT + ":" + "Arteen@2026!Admin")
const DEFAULT_PASSKEY_HASH = '4c56a69497c33fd82a84ade90ce4b58f66510282c30827a2be7aa9c4405ba6b5';

// Default Parameterized Access Token Hash (SHA-256 of "MEA_SECURE_TOKEN_2026" with DEFAULT_SALT)
const DEFAULT_TOKEN_HASH = '7f09d50070f07299239f539336b1597947cb82312130bd9e14761c48df201830';

const SECURITY_STORAGE_KEY = 'mea_security_config_v1';
const RATE_LIMIT_STORAGE_KEY = 'mea_ratelimit_state_v1';

/**
 * Compute SHA-256 hash using Web Crypto API
 */
export async function hashStringSHA256(text, salt = DEFAULT_SALT) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${text}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison between two strings to prevent timing attacks
 */
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

/**
 * Generate cryptographically secure random token (hex string)
 */
export function generateSecureToken(byteLength = 32) {
  const array = new Uint8Array(byteLength);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get active security configuration
 */
export function getSecurityConfig() {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        passkeyHash: parsed.passkeyHash || DEFAULT_PASSKEY_HASH,
        tokenHash: parsed.tokenHash || DEFAULT_TOKEN_HASH,
        salt: parsed.salt || DEFAULT_SALT,
        customToken: parsed.customToken || 'MEA_SECURE_TOKEN_2026',
        updatedAt: parsed.updatedAt || Date.now()
      };
    }
  } catch (e) {
    console.warn('Could not read security config from storage:', e);
  }
  return {
    passkeyHash: DEFAULT_PASSKEY_HASH,
    tokenHash: DEFAULT_TOKEN_HASH,
    salt: DEFAULT_SALT,
    customToken: 'MEA_SECURE_TOKEN_2026',
    updatedAt: Date.now()
  };
}

/**
 * Sync Security Configuration from Turso Cloud
 */
export async function syncSecurityConfigWithTurso() {
  try {
    const cloudConfig = await fetchSecurityConfigFromTurso();
    if (cloudConfig) {
      localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(cloudConfig));
      return cloudConfig;
    }
  } catch (e) {
    console.warn('Could not sync security config from Turso:', e);
  }
  return getSecurityConfig();
}

/**
 * Update security configuration (change master passkey or token) and sync with Turso
 */
export async function updateSecurityConfig({ newPasskey, newToken }) {
  const current = getSecurityConfig();
  const updated = { ...current, updatedAt: Date.now() };

  if (newPasskey && typeof newPasskey === 'string' && newPasskey.trim().length >= 8) {
    updated.passkeyHash = await hashStringSHA256(newPasskey.trim(), updated.salt);
  }

  if (newToken && typeof newToken === 'string' && newToken.trim().length >= 12) {
    updated.customToken = newToken.trim();
    updated.tokenHash = await hashStringSHA256(newToken.trim(), updated.salt);
  }

  try {
    localStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(updated));
    // Also push to Turso in background
    saveSecurityConfigToTurso(updated).catch(err => console.warn('Turso security write error:', err));
    return { success: true, config: updated };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Reset security configuration to defaults
 */
export function resetSecurityConfig() {
  localStorage.removeItem(SECURITY_STORAGE_KEY);
  return getSecurityConfig();
}

/**
 * Verify Master Passkey with Rate Limiting and Constant-Time Comparison
 */
export async function verifyPasskey(passkey) {
  const rateStatus = checkRateLimit();
  if (rateStatus.locked) {
    return {
      valid: false,
      locked: true,
      remainingSeconds: rateStatus.remainingSeconds,
      error: `Too many failed attempts. Security cooldown active for ${rateStatus.remainingSeconds}s.`
    };
  }

  const config = getSecurityConfig();
  const candidateHash = await hashStringSHA256(passkey, config.salt);
  const isValid = timingSafeEqual(candidateHash, config.passkeyHash);

  if (isValid) {
    recordAttemptSuccess();
    return { valid: true };
  } else {
    const updatedRate = recordAttemptFailure();
    return {
      valid: false,
      locked: updatedRate.locked,
      remainingAttempts: updatedRate.remainingAttempts,
      remainingSeconds: updatedRate.remainingSeconds,
      error: updatedRate.locked 
        ? `Too many failed attempts. Security lockout active for ${updatedRate.remainingSeconds}s.`
        : `Invalid passkey. ${updatedRate.remainingAttempts} attempt(s) remaining.`
    };
  }
}

/**
 * Verify Parameterized Access Token (e.g. from URL ?token=...)
 */
export async function verifyAccessToken(token) {
  if (!token || typeof token !== 'string') return false;
  const config = getSecurityConfig();
  const candidateHash = await hashStringSHA256(token.trim(), config.salt);
  return timingSafeEqual(candidateHash, config.tokenHash);
}

// -------------------------------------------------------------
// RATE LIMITING & BRUTE-FORCE PROTECTION
// -------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function checkRateLimit() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return { locked: false, attempts: 0, remainingAttempts: MAX_ATTEMPTS };

    const data = JSON.parse(raw);
    const now = Date.now();

    if (data.lockoutUntil && now < data.lockoutUntil) {
      const remainingSeconds = Math.ceil((data.lockoutUntil - now) / 1000);
      return {
        locked: true,
        attempts: data.attempts,
        remainingAttempts: 0,
        remainingSeconds
      };
    }

    // If lockout has passed, reset
    if (data.lockoutUntil && now >= data.lockoutUntil) {
      localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
      return { locked: false, attempts: 0, remainingAttempts: MAX_ATTEMPTS };
    }

    return {
      locked: false,
      attempts: data.attempts || 0,
      remainingAttempts: Math.max(0, MAX_ATTEMPTS - (data.attempts || 0))
    };
  } catch {
    return { locked: false, attempts: 0, remainingAttempts: MAX_ATTEMPTS };
  }
}

function recordAttemptFailure() {
  const current = checkRateLimit();
  const attempts = (current.attempts || 0) + 1;
  const now = Date.now();
  let lockoutUntil = null;
  let locked = false;
  let remainingSeconds = 0;

  if (attempts >= MAX_ATTEMPTS) {
    locked = true;
    lockoutUntil = now + LOCKOUT_DURATION_MS;
    remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
  }

  const payload = {
    attempts,
    lockoutUntil,
    lastAttempt: now
  };

  try {
    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Rate limit write error:', e);
  }

  return {
    locked,
    attempts,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts),
    remainingSeconds
  };
}

function recordAttemptSuccess() {
  try {
    localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  } catch {
    // Ignore storage clear errors
  }
}

// -------------------------------------------------------------
// SESSION MANAGEMENT & REVOCATION
// -------------------------------------------------------------
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity
let activeSessionToken = null;
let sessionTimer = null;
let sessionListeners = [];

export function createAdminSession() {
  const token = generateSecureToken(32);
  const now = Date.now();
  activeSessionToken = {
    token,
    createdAt: now,
    expiresAt: now + SESSION_TIMEOUT_MS,
    lastActivity: now
  };

  resetSessionInactivityTimer();
  notifySessionChange(true);
  return token;
}

export function isSessionValid() {
  if (!activeSessionToken) return false;
  const now = Date.now();
  if (now > activeSessionToken.expiresAt) {
    revokeAdminSession();
    return false;
  }
  return true;
}

export function touchSession() {
  if (!activeSessionToken) return false;
  const now = Date.now();
  if (now > activeSessionToken.expiresAt) {
    revokeAdminSession();
    return false;
  }
  activeSessionToken.lastActivity = now;
  activeSessionToken.expiresAt = now + SESSION_TIMEOUT_MS;
  resetSessionInactivityTimer();
  return true;
}

export function revokeAdminSession() {
  activeSessionToken = null;
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
  notifySessionChange(false);
}

export function subscribeToSession(callback) {
  sessionListeners.push(callback);
  return () => {
    sessionListeners = sessionListeners.filter(cb => cb !== callback);
  };
}

function notifySessionChange(isAuthenticated) {
  sessionListeners.forEach(cb => {
    try {
      cb(isAuthenticated);
    } catch (e) {
      console.error('Session listener error:', e);
    }
  });
}

function resetSessionInactivityTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    revokeAdminSession();
  }, SESSION_TIMEOUT_MS);
}

// -------------------------------------------------------------
// INPUT SANITIZATION & SAFE URL VALIDATION
// -------------------------------------------------------------

/**
 * Sanitize plain text string against HTML/XSS injection
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and sanitize image URLs (allowing relative /campaigns/*, https:, http:, and safe data:image/*)
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '/campaigns/c1.jpg';
  const trimmed = url.trim();

  // Relative path to local campaigns
  if (trimmed.startsWith('/campaigns/') || trimmed.startsWith('./campaigns/') || trimmed.startsWith('campaigns/')) {
    return trimmed;
  }

  // Safe Web Protocols
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }

  // Safe Data URIs (Images only)
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }

  // Dangerous protocols rejected
  console.warn('Rejected unsafe image URL scheme:', trimmed.substring(0, 30));
  return '/campaigns/c1.jpg';
}

/**
 * Validate uploaded image file (size, MIME type, and SVG script scanning)
 */
export async function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // 10MB file size limit
  const MAX_SIZE_BYTES = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    return { valid: false, error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.` };
  }

  // Whitelisted MIME types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/svg+xml'
  ];

  if (!allowedMimeTypes.includes(file.type.toLowerCase())) {
    return { valid: false, error: `Unsupported file format: ${file.type}. Please upload JPG, PNG, WebP, GIF, or SVG.` };
  }

  // If SVG, perform sanitization scan to prevent embedded script attacks
  if (file.type === 'image/svg+xml') {
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');

      // Check for parsing errors
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return { valid: false, error: 'Malformed SVG file structure.' };
      }

      // Check for script tags or dangerous attributes
      const scripts = doc.querySelectorAll('script');
      if (scripts.length > 0) {
        return { valid: false, error: 'Security alert: Embedded scripts in SVG are strictly prohibited.' };
      }

      // Check all elements for inline javascript handlers (onload, onerror, onclick, etc.)
      const allElements = doc.querySelectorAll('*');
      for (const el of allElements) {
        for (let i = 0; i < el.attributes.length; i++) {
          const attrName = el.attributes[i].name.toLowerCase();
          const attrVal = el.attributes[i].value.toLowerCase();
          if (attrName.startsWith('on') || attrVal.includes('javascript:') || attrVal.includes('data:text/html')) {
            return { valid: false, error: `Security alert: Prohibited attribute "${attrName}" detected in SVG.` };
          }
        }
      }
    } catch (e) {
      return { valid: false, error: `SVG analysis failed: ${e.message}` };
    }
  }

  return { valid: true };
}

/**
 * Sanitize external hyperlink (project link, case study, client URL)
 * Prevents javascript: and data: XSS execution
 */
export function sanitizeExternalUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Valid safe protocols
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('mailto:')) {
    return trimmed;
  }

  // If user typed domain like "behance.net/..." without https://, prepend https://
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  console.warn('Rejected potentially unsafe hyperlink URL:', trimmed.substring(0, 30));
  return '';
}

