import { verifyAdminCredentials, createSession, setSessionCookie } from '../_lib/auth.js';
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from '../_lib/rateLimiter.js';
import { logAuditEvent } from '../_lib/audit.js';
import { parseBody } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check rate limiting
  const rateLimitStatus = checkLoginRateLimit(req);
  if (rateLimitStatus.isLimited) {
    await logAuditEvent(req, {
      eventType: 'RATE_LIMITED',
      actor: 'anonymous',
      success: false,
      metadata: { remainingSeconds: rateLimitStatus.remainingSeconds }
    });
    return res.status(429).json({ error: rateLimitStatus.error });
  }

  const body = await parseBody(req);
  const effectiveUsername = body.username ? String(body.username).trim() : 'admin';
  const effectivePassword = body.passkey ? String(body.passkey) : (body.password ? String(body.password) : '');

  if (!effectivePassword) {
    recordFailedLogin(req);
    return res.status(400).json({ error: 'Administrator passkey or credentials are required.' });
  }

  try {
    const isValid = await verifyAdminCredentials(effectiveUsername, effectivePassword);

    if (!isValid) {
      recordFailedLogin(req);
      await logAuditEvent(req, {
        eventType: 'LOGIN_FAILED',
        actor: effectiveUsername.slice(0, 50),
        success: false
      });
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Reset rate limiter on successful auth
    resetLoginRateLimit(req);

    // Create session and set cookie
    const { tokenValue, expiresAt } = await createSession('admin');
    setSessionCookie(res, tokenValue, expiresAt);

    await logAuditEvent(req, {
      eventType: 'LOGIN_SUCCESS',
      actor: 'admin',
      success: true
    });

    return res.status(200).json({
      success: true,
      authenticated: true,
      role: 'admin',
      message: 'Authenticated successfully.'
    });
  } catch (err) {
    console.error('Login handler error:', err);
    return res.status(500).json({ error: 'An unexpected authentication error occurred.' });
  }
}
