import { parseCookies, validateSessionToken, destroySession, clearSessionCookie } from '../_lib/auth.js';
import { logAuditEvent } from '../_lib/audit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req);
  const tokenValue = cookies.mea_session;

  if (tokenValue) {
    const session = await validateSessionToken(tokenValue);
    if (session) {
      await destroySession(session.sessionId);
      await logAuditEvent(req, {
        eventType: 'LOGOUT',
        actor: session.userId || 'admin',
        success: true
      });
    }
  }

  clearSessionCookie(res);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
}
