import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import server modules directly for testing
import loginHandler from '../api/auth/login.js';
import logoutHandler from '../api/auth/logout.js';
import sessionHandler from '../api/auth/session.js';
import accessLinkHandler from '../api/auth/access-link.js';
import campaignsHandler from '../api/campaigns.js';
import adminCampaignsHandler from '../api/admin/campaigns.js';
import adminReorderHandler from '../api/admin/reorder.js';
import adminImportHandler from '../api/admin/import.js';
import adminResetHandler from '../api/admin/reset.js';
import adminSecurityHandler from '../api/admin/security.js';
import adminHealthHandler from '../api/admin/health.js';
import adminAuditLogsHandler from '../api/admin/audit-logs.js';

import { validateUrl, sanitizeSvg, validateCampaignInput } from '../api/_lib/validation.js';
import { createSession, validateSessionToken } from '../api/_lib/auth.js';
import { checkLoginRateLimit, recordFailedLogin, resetLoginRateLimit } from '../api/_lib/rateLimiter.js';

// Helper to mock request & response for serverless handler testing
function createMockReqRes({ method = 'GET', body = {}, query = {}, headers = {} } = {}) {
  const req = {
    method,
    body,
    query,
    headers: { ...headers },
    socket: { remoteAddress: '127.0.0.1' }
  };

  let statusCode = 200;
  let headersSent = {};
  let responseData = null;

  const res = {
    statusCode: 200,
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headersSent[name.toLowerCase()] = value;
      return this;
    },
    getHeader(name) {
      return headersSent[name.toLowerCase()];
    },
    json(data) {
      responseData = data;
      return this;
    },
    end(data) {
      if (typeof data === 'string') {
        try { responseData = JSON.parse(data); } catch { responseData = data; }
      }
      return this;
    },
    _getStatusCode() { return statusCode; },
    _getData() { return responseData; },
    _getHeaders() { return headersSent; }
  };

  return { req, res };
}

describe('SECURITY ARCHITECTURE SUITE', () => {

  before(() => {
    process.env.TURSO_DATABASE_URL = 'https://martin-artin-portfolio-martinemilapps-lab.aws-us-east-2.turso.io';
    process.env.TURSO_AUTH_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcwODM5MDksImlkIjoiMDFhMDAyNzYtYzMwMS03YTAwLTg3MzktY2I2ZTg1ODZjYmNiIiwia2lkIjoiNDR6TE5Bd2xheWQ5clB3R1NvMV96ZFk0Z2pOODNzbU13ajcwMkhWdWEtWSIsInJpZCI6ImRlZDMzNWE5LWVlYjctNDhmNS05MDgxLTQ3MDFhM2UyNDg4OSJ9.mMejFAoSLvM3hX0TO4yVxUCKKb9UABrXxAubbXh0potz-D97Xa_rLmNQ8clPGlLqffyYtKUNUGf-8UxAkI5dAg';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'marmin100';
    process.env.SESSION_SECRET = 'test_secret_entropy_2026_key_99999';
  });

  // -------------------------------------------------------------
  // 1. PUBLIC READ-ONLY ENDPOINT
  // -------------------------------------------------------------
  test('1. Unauthenticated GET /api/campaigns succeeds and returns public campaigns without secrets', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await campaignsHandler(req, res);
    assert.equal(res._getStatusCode(), 200);
    const data = res._getData();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.campaigns));
    assert.ok(data.campaigns.length > 0);
    // Ensure no secrets are leaked in public response
    for (const c of data.campaigns) {
      assert.equal(c.password, undefined);
      assert.equal(c.passkeyHash, undefined);
      assert.equal(c.token, undefined);
      assert.equal(c.authToken, undefined);
    }
  });

  // -------------------------------------------------------------
  // 2. UNAUTHENTICATED MUTATION PROTECTION
  // -------------------------------------------------------------
  test('2. Unauthenticated POST /api/admin/campaigns returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ 
      method: 'POST', 
      body: { title: 'Hacked Campaign', image: 'https://example.com/img.jpg' } 
    });
    await adminCampaignsHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('3. Unauthenticated DELETE /api/admin/campaigns returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'DELETE', query: { id: 1 } });
    await adminCampaignsHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('4. Unauthenticated POST /api/admin/reorder returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'POST', body: { campaignIds: [2, 1] } });
    await adminReorderHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('5. Unauthenticated POST /api/admin/import returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'POST', body: { campaigns: [] } });
    await adminImportHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('6. Unauthenticated POST /api/admin/reset returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'POST' });
    await adminResetHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('7. Unauthenticated POST /api/admin/security returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'POST', body: { newPassword: 'newpassword123' } });
    await adminSecurityHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('8. Unauthenticated GET /api/admin/health returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await adminHealthHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  test('9. Unauthenticated GET /api/admin/audit-logs returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await adminAuditLogsHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  // -------------------------------------------------------------
  // 3. AUTHENTICATION, SESSIONS & COOKIES
  // -------------------------------------------------------------
  test('10. Invalid login credentials return 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { username: 'wronguser', password: 'wrongpassword' }
    });
    await loginHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
    assert.equal(res._getData().error, 'Invalid credentials.');
  });

  test('11a. Valid bootstrap credentials create secure session and set HttpOnly cookie', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { username: 'admin', password: 'marmin100' }
    });
    await loginHandler(req, res);
    assert.equal(res._getStatusCode(), 200);
    const data = res._getData();
    assert.equal(data.authenticated, true);
    assert.equal(data.role, 'admin');

    const setCookie = res._getHeaders()['set-cookie'];
    assert.ok(setCookie, 'Set-Cookie header must be present');
    assert.ok(setCookie.includes('HttpOnly'), 'Cookie must have HttpOnly');
    assert.ok(setCookie.includes('SameSite=Lax'), 'Cookie must have SameSite');
    assert.ok(setCookie.includes('mea_session='), 'Cookie name must be mea_session');
  });

  test('11b. Valid single passkey marmin100 payload authenticates successfully', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { passkey: 'marmin100' }
    });
    await loginHandler(req, res);
    assert.equal(res._getStatusCode(), 200);
    const data = res._getData();
    assert.equal(data.authenticated, true);
    assert.equal(data.role, 'admin');
  });

  test('11c. Invalid passkey returns 401 Unauthorized', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { passkey: 'wrongpasskey123' }
    });
    await loginHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
    assert.equal(res._getData().error, 'Invalid credentials.');
  });

  test('12. GET /api/auth/session validates session cookie', async () => {
    const { tokenValue } = await createSession('admin');
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { cookie: `mea_session=${tokenValue}` }
    });
    await sessionHandler(req, res);
    assert.equal(res._getStatusCode(), 200);
    assert.equal(res._getData().authenticated, true);
    assert.equal(res._getData().role, 'admin');
  });

  test('13. POST /api/auth/logout invalidates session and clears cookie', async () => {
    const { tokenValue } = await createSession('admin');
    const { req, res } = createMockReqRes({
      method: 'POST',
      headers: { cookie: `mea_session=${tokenValue}` }
    });
    await logoutHandler(req, res);
    assert.equal(res._getStatusCode(), 200);

    const setCookie = res._getHeaders()['set-cookie'];
    assert.ok(setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970'));

    // Verify session is revoked in database
    const validated = await validateSessionToken(tokenValue);
    assert.equal(validated, null);
  });

  test('14. Tampered or forged session token returns 401 Unauthorized', async () => {
    const forgedToken = 'fake_session_id_123456789.9999999999999.forged_signature';
    const { req, res } = createMockReqRes({
      method: 'GET',
      headers: { cookie: `mea_session=${forgedToken}` }
    });
    await adminHealthHandler(req, res);
    assert.equal(res._getStatusCode(), 401);
  });

  // -------------------------------------------------------------
  // 4. RATE LIMITING
  // -------------------------------------------------------------
  test('15. Rate limiting activates after 5 failed login attempts', async () => {
    const testReq = { headers: { 'x-forwarded-for': '198.51.100.42' }, socket: {} };
    resetLoginRateLimit(testReq);

    for (let i = 0; i < 5; i++) {
      recordFailedLogin(testReq);
    }

    const status = checkLoginRateLimit(testReq);
    assert.equal(status.isLimited, true);
    assert.ok(status.remainingSeconds > 0);

    // Clean up
    resetLoginRateLimit(testReq);
  });

  // -------------------------------------------------------------
  // 5. INPUT, URL & SVG VALIDATION
  // -------------------------------------------------------------
  test('16. Valid HTTPS URL passes validation', () => {
    assert.equal(validateUrl('https://example.com/case-study'), 'https://example.com/case-study');
    assert.equal(validateUrl('/campaigns/c1.jpg'), '/campaigns/c1.jpg');
  });

  test('17. Malicious javascript: and data: URLs are rejected', () => {
    assert.throws(() => validateUrl('javascript:alert(1)'));
    assert.throws(() => validateUrl('vbscript:msgbox(1)'));
    assert.throws(() => validateUrl('data:text/html,<script>alert(1)</script>'));
  });

  test('18. Malicious SVG with embedded <script> is rejected', () => {
    const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>';
    assert.throws(() => sanitizeSvg(maliciousSvg), /disallowed active content/);
  });

  test('19. Malicious SVG with inline onload= handler is rejected', () => {
    const maliciousSvg = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>';
    assert.throws(() => sanitizeSvg(maliciousSvg), /disallowed active content/);
  });

  test('20. Clean SVG passes validation', () => {
    const cleanSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>';
    assert.equal(sanitizeSvg(cleanSvg), cleanSvg);
  });

  test('21. Campaign input validation enforces required fields and whitelisting', () => {
    assert.throws(() => validateCampaignInput({}), /Campaign title is required/);
    assert.throws(() => validateCampaignInput({ title: 'Test' }), /Hero Image is required/);

    const valid = validateCampaignInput({
      title: 'Valid Campaign',
      image: 'https://example.com/hero.jpg',
      tagline: 'Super Tagline',
      link: 'https://example.com/project',
      __proto__: { isAdmin: true } // Attempt prototype pollution
    });

    assert.equal(valid.title, 'Valid Campaign');
    assert.equal(valid.image, 'https://example.com/hero.jpg');
    assert.equal(valid.isAdmin, undefined);
  });

  // -------------------------------------------------------------
  // 6. SINGLE-USE ACCESS LINK LIFECYCLE
  // -------------------------------------------------------------
  test('22. Single-use access link can be generated and consumed only once', async () => {
    const { tokenValue } = await createSession('admin');
    
    // Generate link
    const { req: genReq, res: genRes } = createMockReqRes({
      method: 'POST',
      body: { action: 'generate' },
      headers: { cookie: `mea_session=${tokenValue}` }
    });
    await accessLinkHandler(genReq, genRes);
    assert.equal(genRes._getStatusCode(), 200);
    const token = genRes._getData().token;
    assert.ok(token);

    // Consume link (first time -> SUCCESS)
    const { req: conReq, res: conRes } = createMockReqRes({
      method: 'POST',
      body: { action: 'consume', token }
    });
    await accessLinkHandler(conReq, conRes);
    assert.equal(conRes._getStatusCode(), 200);
    assert.equal(conRes._getData().authenticated, true);

    // Consume link (second time -> REJECTED)
    const { req: con2Req, res: con2Res } = createMockReqRes({
      method: 'POST',
      body: { action: 'consume', token }
    });
    await accessLinkHandler(con2Req, con2Res);
    assert.equal(con2Res._getStatusCode(), 401);
  });

  // -------------------------------------------------------------
  // 7. CLIENT BUNDLE & SOURCE REPOSITORY LEAK AUDIT
  // -------------------------------------------------------------
  test('23. Source files in src/ contain zero Turso credentials or hardcoded admin passwords', () => {
    const srcDir = path.resolve(process.cwd(), 'src');
    const files = fs.readdirSync(srcDir, { recursive: true });

    for (const f of files) {
      const fullPath = path.join(srcDir, f);
      if (fs.statSync(fullPath).isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.html'))) {
        const content = fs.readFileSync(fullPath, 'utf8');

        // Check for leaked database token signatures
        assert.ok(!content.includes('eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9'), `Leaked Turso JWT token found in ${f}`);
        // Check for old default password
        assert.ok(!content.includes('Arteen@2026!Admin'), `Leaked old password found in ${f}`);
        // Check for hardcoded master token
        assert.ok(!content.includes('MEA_SECURE_TOKEN_2026'), `Leaked token found in ${f}`);
        // Check for client-side VITE_TURSO
        assert.ok(!content.includes('VITE_TURSO_AUTH_TOKEN'), `VITE_TURSO_AUTH_TOKEN found in ${f}`);
        // Check for passkey marmin100 in client bundle
        assert.ok(!content.includes('marmin100'), `Passkey marmin100 leaked in client file ${f}`);
      }
    }
  });

});
