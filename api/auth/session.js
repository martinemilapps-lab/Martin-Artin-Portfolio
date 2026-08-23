import { parseCookies, validateSessionToken, clearSessionCookie } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cookies = parseCookies(req);
  const tokenValue = cookies.mea_session;

  if (!tokenValue) {
    return res.status(200).json({ authenticated: false });
  }

  const session = await validateSessionToken(tokenValue);

  if (!session) {
    clearSessionCookie(res);
    return res.status(200).json({ authenticated: false });
  }

  return res.status(200).json({
    authenticated: true,
    role: 'admin',
    user: session.userId
  });
}
