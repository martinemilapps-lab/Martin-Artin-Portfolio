import { requireAdmin, verifyAdminCredentials, updateAdminPassword, createSession, setSessionCookie } from '../_lib/auth.js';
import { logAuditEvent } from '../_lib/audit.js';

import { parseBody } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401 response already sent

  const { currentPassword, newPassword } = await parseBody(req);

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 12) {
    return res.status(400).json({ error: 'New password must be at least 12 characters long.' });
  }

  try {
    // Verify current password first
    const isCurrentValid = await verifyAdminCredentials('admin', currentPassword);
    if (!isCurrentValid) {
      await logAuditEvent(req, {
        eventType: 'PASSWORD_CHANGE_FAILED',
        actor: admin.userId,
        success: false,
        metadata: { reason: 'Incorrect current password' }
      });
      return res.status(401).json({ error: 'Incorrect current password.' });
    }

    // Update password in database and invalidate old sessions
    await updateAdminPassword(newPassword);

    // Create fresh session for the current administrator
    const { tokenValue, expiresAt } = await createSession(admin.userId);
    setSessionCookie(res, tokenValue, expiresAt);

    await logAuditEvent(req, {
      eventType: 'PASSWORD_CHANGE',
      actor: admin.userId,
      success: true
    });

    return res.status(200).json({
      success: true,
      message: 'Master administrator password updated successfully. Prior sessions have been revoked.'
    });
  } catch (err) {
    console.error('Error changing password:', err);
    return res.status(500).json({ error: 'Failed to update administrator password.' });
  }
}
