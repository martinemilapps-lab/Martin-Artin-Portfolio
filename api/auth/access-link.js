import crypto from 'node:crypto';
import { requireAdmin, createSession, setSessionCookie } from '../_lib/auth.js';
import { getDbClient, ensureDatabaseSchema } from '../_lib/db.js';
import { logAuditEvent } from '../_lib/audit.js';

import { parseBody } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await parseBody(req);
  const action = body.action || 'generate';
  const token = body.token;

  await ensureDatabaseSchema();
  const client = getDbClient();

  // ACTION: GENERATE (Admin Only)
  if (action === 'generate') {
    const admin = await requireAdmin(req, res);
    if (!admin) return; // 401 response already sent

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes lifetime

    await client.execute({
      sql: `INSERT INTO access_links (id, created_at, expires_at, used, created_by)
            VALUES (?, ?, ?, 0, ?);`,
      args: [tokenHash, now.toISOString(), expiresAt.toISOString(), admin.userId || 'admin']
    });

    await logAuditEvent(req, {
      eventType: 'ACCESS_LINK_GENERATED',
      actor: admin.userId || 'admin',
      success: true
    });

    return res.status(200).json({
      success: true,
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
      expiresInMinutes: 10,
      message: 'Single-use access link generated. Valid for 10 minutes.'
    });
  }

  // ACTION: CONSUME (Public Single-Use Link Redemption)
  if (action === 'consume') {
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Access token is required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Check if token exists, is unused, and not expired
    const result = await client.execute({
      sql: 'SELECT id, created_at, expires_at, used FROM access_links WHERE id = ?;',
      args: [tokenHash]
    });

    if (result.rows.length === 0) {
      await logAuditEvent(req, {
        eventType: 'ACCESS_LINK_CONSUMED',
        actor: 'anonymous',
        success: false,
        metadata: { reason: 'Token not found' }
      });
      return res.status(401).json({ error: 'Invalid or expired access link.' });
    }

    const row = result.rows[0];

    if (row.used === 1 || Number(row.used) === 1) {
      return res.status(401).json({ error: 'This access link has already been used.' });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'This access link has expired.' });
    }

    // Burn token immediately
    await client.execute({
      sql: 'UPDATE access_links SET used = 1 WHERE id = ?;',
      args: [tokenHash]
    });

    // Create session & issue cookie
    const { tokenValue, expiresAt } = await createSession('admin');
    setSessionCookie(res, tokenValue, expiresAt);

    await logAuditEvent(req, {
      eventType: 'ACCESS_LINK_CONSUMED',
      actor: 'admin',
      success: true
    });

    return res.status(200).json({
      success: true,
      authenticated: true,
      role: 'admin',
      message: 'Access link verified. Session established.'
    });
  }

  return res.status(400).json({ error: `Unknown action "${action}".` });
}
