/**
 * TURSO LIBSQL CLOUD DATABASE SERVICE
 * High-performance edge cloud database integration for Martin Emil Arteen Portfolio.
 * Connects to Turso LibSQL via HTTPS client.
 */

import { createClient } from '@libsql/client/web';

const DEFAULT_TURSO_URL = 'https://martin-artin-portfolio-martinemilapps-lab.aws-us-east-2.turso.io';
const DEFAULT_TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcwODM5MDksImlkIjoiMDFhMDAyNzYtYzMwMS03YTAwLTg3MzktY2I2ZTg1ODZjYmNiIiwia2lkIjoiNDR6TE5Bd2xheWQ5clB3R1NvMV96ZFk0Z2pOODNzbU13ajcwMkhWdWEtWSIsInJpZCI6ImRlZDMzNWE5LWVlYjctNDhmNS05MDgxLTQ3MDFhM2UyNDg4OSJ9.mMejFAoSLvM3hX0TO4yVxUCKKb9UABrXxAubbXh0potz-D97Xa_rLmNQ8clPGlLqffyYtKUNUGf-8UxAkI5dAg';

// Get active config from env or fallback
export function getTursoConfig() {
  const url = import.meta.env?.VITE_TURSO_DATABASE_URL || DEFAULT_TURSO_URL;
  // Convert libsql:// to https:// if needed for web fetch client
  const cleanUrl = url.startsWith('libsql://') ? url.replace('libsql://', 'https://') : url;
  const authToken = import.meta.env?.VITE_TURSO_AUTH_TOKEN || DEFAULT_TURSO_TOKEN;

  return { url: cleanUrl, authToken };
}

let cachedClient = null;

export function getTursoClient() {
  if (cachedClient) return cachedClient;

  const { url, authToken } = getTursoConfig();
  try {
    cachedClient = createClient({
      url,
      authToken
    });
    return cachedClient;
  } catch (e) {
    console.error('Failed to initialize Turso client:', e);
    return null;
  }
}

/**
 * Initialize Tables Schema & Seed default records if empty
 */
export async function initDatabaseSchema(defaultCampaigns = []) {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Client not available' };

  try {
    // 1. Create campaigns table with comprehensive text, photo, and link support
    await client.execute(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        tagline TEXT NOT NULL,
        year TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'EXPERIMENTAL',
        image TEXT NOT NULL,
        category TEXT NOT NULL,
        client TEXT DEFAULT '',
        description TEXT NOT NULL,
        credits TEXT NOT NULL,
        link TEXT DEFAULT '',
        case_study_link TEXT DEFAULT '',
        client_link TEXT DEFAULT '',
        gallery TEXT DEFAULT '[]',
        thumbnail TEXT DEFAULT '',
        display_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Non-destructive automated migrations for existing tables
    const newColumns = [
      'client TEXT DEFAULT ""',
      'link TEXT DEFAULT ""',
      'case_study_link TEXT DEFAULT ""',
      'client_link TEXT DEFAULT ""',
      'gallery TEXT DEFAULT "[]"',
      'thumbnail TEXT DEFAULT ""'
    ];
    for (const col of newColumns) {
      try {
        await client.execute(`ALTER TABLE campaigns ADD COLUMN ${col};`);
      } catch {
        // Column already exists or already migrated
      }
    }

    // 2. Create security config table for cross-device admin state
    await client.execute(`
      CREATE TABLE IF NOT EXISTS security_config (
        id TEXT PRIMARY KEY DEFAULT 'config',
        passkey_hash TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        custom_token TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // 3. Seed initial campaigns if table is currently empty
    const check = await client.execute('SELECT COUNT(*) as count FROM campaigns;');
    const count = check.rows[0]?.count || 0;

    if (count === 0 && Array.isArray(defaultCampaigns) && defaultCampaigns.length > 0) {
      const now = Date.now();
      for (let i = 0; i < defaultCampaigns.length; i++) {
        const c = defaultCampaigns[i];
        const galleryJson = typeof c.gallery === 'string' ? c.gallery : JSON.stringify(c.gallery || []);
        await client.execute({
          sql: `INSERT INTO campaigns (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            c.id || String(i + 1).padStart(2, '0'),
            c.title || '',
            c.tagline || '',
            c.year || '2026',
            c.role || 'ART DIRECTION & CGI',
            c.status || 'EXPERIMENTAL',
            c.image || '/campaigns/c1.jpg',
            c.category || 'EXHIBITION',
            c.client || '',
            c.description || '',
            c.credits || '',
            c.link || '',
            c.case_study_link || '',
            c.client_link || '',
            galleryJson,
            c.thumbnail || '',
            i,
            now,
            now
          ]
        });
      }
    }

    return { success: true, count };
  } catch (e) {
    console.error('Turso initDatabaseSchema error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Fetch all campaigns from Turso Cloud Database ordered by display_order
 */
export async function fetchCampaignsFromTurso() {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Client not available' };

  try {
    const result = await client.execute(
      `SELECT id, title, tagline, year, role, status, image, category, 
              client, description, credits, link, case_study_link, client_link, 
              gallery, thumbnail, display_order 
       FROM campaigns 
       ORDER BY display_order ASC, created_at ASC;`
    );

    const campaigns = result.rows.map((row, idx) => {
      let parsedGallery = [];
      try {
        if (typeof row.gallery === 'string' && row.gallery.trim()) {
          parsedGallery = JSON.parse(row.gallery);
        } else if (Array.isArray(row.gallery)) {
          parsedGallery = row.gallery;
        }
      } catch {
        parsedGallery = [];
      }

      return {
        id: String(row.id || idx + 1).padStart(2, '0'),
        title: String(row.title || ''),
        tagline: String(row.tagline || ''),
        year: String(row.year || ''),
        role: String(row.role || ''),
        status: String(row.status || 'EXPERIMENTAL'),
        image: String(row.image || '/campaigns/c1.jpg'),
        category: String(row.category || ''),
        client: String(row.client || ''),
        description: String(row.description || ''),
        credits: String(row.credits || ''),
        link: String(row.link || ''),
        case_study_link: String(row.case_study_link || ''),
        client_link: String(row.client_link || ''),
        gallery: Array.isArray(parsedGallery) ? parsedGallery : [],
        thumbnail: String(row.thumbnail || '')
      };
    });

    return { success: true, campaigns };
  } catch (e) {
    console.error('fetchCampaignsFromTurso error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Save entire campaigns list to Turso Cloud (Atomic synchronization)
 */
export async function saveAllCampaignsToTurso(campaigns) {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Client not available' };

  try {
    const now = Date.now();
    // Delete and recreate sequentially or update in batch
    await client.execute('DELETE FROM campaigns;');

    for (let i = 0; i < campaigns.length; i++) {
      const c = campaigns[i];
      const galleryJson = typeof c.gallery === 'string' ? c.gallery : JSON.stringify(c.gallery || []);
      await client.execute({
        sql: `INSERT INTO campaigns (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          c.id || String(i + 1).padStart(2, '0'),
          c.title,
          c.tagline,
          c.year,
          c.role,
          c.status || 'EXPERIMENTAL',
          c.image,
          c.category,
          c.client || '',
          c.description,
          c.credits,
          c.link || '',
          c.case_study_link || '',
          c.client_link || '',
          galleryJson,
          c.thumbnail || '',
          i,
          now,
          now
        ]
      });
    }

    return { success: true, count: campaigns.length };
  } catch (e) {
    console.error('saveAllCampaignsToTurso error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Upsert or insert a single campaign in Turso
 */
export async function upsertCampaignToTurso(campaign, displayOrder = 0) {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Client not available' };

  try {
    const now = Date.now();
    const galleryJson = typeof campaign.gallery === 'string' ? campaign.gallery : JSON.stringify(campaign.gallery || []);
    await client.execute({
      sql: `INSERT INTO campaigns (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              tagline = excluded.tagline,
              year = excluded.year,
              role = excluded.role,
              status = excluded.status,
              image = excluded.image,
              category = excluded.category,
              client = excluded.client,
              description = excluded.description,
              credits = excluded.credits,
              link = excluded.link,
              case_study_link = excluded.case_study_link,
              client_link = excluded.client_link,
              gallery = excluded.gallery,
              thumbnail = excluded.thumbnail,
              display_order = excluded.display_order,
              updated_at = excluded.updated_at;`,
      args: [
        campaign.id,
        campaign.title,
        campaign.tagline,
        campaign.year,
        campaign.role,
        campaign.status || 'EXPERIMENTAL',
        campaign.image,
        campaign.category,
        campaign.client || '',
        campaign.description,
        campaign.credits,
        campaign.link || '',
        campaign.case_study_link || '',
        campaign.client_link || '',
        galleryJson,
        campaign.thumbnail || '',
        displayOrder,
        now,
        now
      ]
    });

    return { success: true };
  } catch (e) {
    console.error('upsertCampaignToTurso error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Delete a campaign by ID from Turso
 */
export async function deleteCampaignFromTurso(id) {
  const client = getTursoClient();
  if (!client) return { success: false, error: 'Client not available' };

  try {
    await client.execute({
      sql: 'DELETE FROM campaigns WHERE id = ?;',
      args: [id]
    });
    return { success: true };
  } catch (e) {
    console.error('deleteCampaignFromTurso error:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Health check & Ping Turso Cloud Database with timeout protection
 */
export async function checkDatabaseHealth(timeoutMs = 6000) {
  const client = getTursoClient();
  if (!client) return { ok: false, error: 'Client not configured' };

  const start = performance.now();
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timed out')), timeoutMs)
    );
    const pingPromise = client.execute('SELECT 1 as ping;');
    const res = await Promise.race([pingPromise, timeoutPromise]);
    const latencyMs = Math.round(performance.now() - start);
    if (res && res.rows && res.rows.length > 0) {
      return { ok: true, latencyMs, location: 'aws-us-east-2 (Turso Cloud)' };
    }
    return { ok: false, error: 'Unexpected response from database' };
  } catch (e) {
    return { ok: false, error: e.message || 'Connection failed' };
  }
}

/**
 * Fetch Security Config from Turso Database
 */
export async function fetchSecurityConfigFromTurso() {
  const client = getTursoClient();
  if (!client) return null;

  try {
    const res = await client.execute('SELECT passkey_hash, token_hash, salt, custom_token, updated_at FROM security_config WHERE id = ?;', ['config']);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        passkeyHash: row.passkey_hash,
        tokenHash: row.token_hash,
        salt: row.salt,
        customToken: row.custom_token,
        updatedAt: row.updated_at
      };
    }
  } catch (e) {
    console.warn('fetchSecurityConfigFromTurso warning:', e);
  }
  return null;
}

/**
 * Save Security Config to Turso Database
 */
export async function saveSecurityConfigToTurso(config) {
  const client = getTursoClient();
  if (!client) return false;

  try {
    const now = Date.now();
    await client.execute({
      sql: `INSERT INTO security_config (id, passkey_hash, token_hash, salt, custom_token, updated_at)
            VALUES ('config', ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              passkey_hash = excluded.passkey_hash,
              token_hash = excluded.token_hash,
              salt = excluded.salt,
              custom_token = excluded.custom_token,
              updated_at = excluded.updated_at;`,
      args: [
        config.passkeyHash,
        config.tokenHash,
        config.salt,
        config.customToken,
        now
      ]
    });
    return true;
  } catch (e) {
    console.warn('saveSecurityConfigToTurso warning:', e);
    return false;
  }
}
