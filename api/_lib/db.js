import { createClient } from '@libsql/client/web';
import { defaultCampaigns } from './defaultCampaigns.js';

let dbClient = null;
let isSchemaInitialized = false;

/**
 * Get or initialize the server-side Turso LibSQL client
 */
export function getDbClient() {
  if (dbClient) return dbClient;

  const url = process.env.TURSO_DATABASE_URL || 'https://martin-artin-portfolio-martinemilapps-lab.aws-us-east-2.turso.io';
  const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODcwODM5MDksImlkIjoiMDFhMDAyNzYtYzMwMS03YTAwLTg3MzktY2I2ZTg1ODZjYmNiIiwia2lkIjoiNDR6TE5Bd2xheWQ5clB3R1NvMV96ZFk0Z2pOODNzbU13ajcwMkhWdWEtWSIsInJpZCI6ImRlZDMzNWE5LWVlYjctNDhmNS05MDgxLTQ3MDFhM2UyNDg4OSJ9.mMejFAoSLvM3hX0TO4yVxUCKKb9UABrXxAubbXh0potz-D97Xa_rLmNQ8clPGlLqffyYtKUNUGf-8UxAkI5dAg';

  if (!url) {
    throw new Error('Server configuration error: TURSO_DATABASE_URL is not defined.');
  }

  dbClient = createClient({
    url: url.replace(/^libsql:\/\//i, 'https://'),
    authToken: authToken || undefined,
  });

  return dbClient;
}

/**
 * Initialize database tables if they do not exist.
 * This runs securely on the server only.
 */
export async function ensureDatabaseSchema() {
  if (isSchemaInitialized) return;
  const client = getDbClient();

  // Create campaigns table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      tagline TEXT,
      year TEXT,
      role TEXT,
      status TEXT,
      image TEXT NOT NULL,
      category TEXT,
      client TEXT,
      description TEXT,
      credits TEXT,
      link TEXT,
      case_study_link TEXT,
      client_link TEXT,
      gallery TEXT,
      thumbnail TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );
  `);

  // Create index for display_order
  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_campaigns_order ON campaigns(display_order);
  `);

  // Create audit_logs table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT,
      resource_type TEXT,
      resource_id TEXT,
      ip TEXT,
      success INTEGER NOT NULL DEFAULT 1,
      metadata TEXT
    );
  `);

  // Create access_links table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS access_links (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_by TEXT
    );
  `);

  // Create admin_sessions table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      session_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
  `);

  // Create admin_credentials table for server-side password updates
  await client.execute(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed default campaigns if table is empty
  const countRes = await client.execute('SELECT COUNT(*) as count FROM campaigns;');
  const count = Number(countRes.rows[0]?.count || 0);

  if (count === 0) {
    for (let i = 0; i < defaultCampaigns.length; i++) {
      const c = defaultCampaigns[i];
      await client.execute({
        sql: `INSERT INTO campaigns 
              (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          c.id,
          c.title,
          c.tagline || '',
          c.year || '',
          c.role || '',
          c.status || '',
          c.image,
          c.category || '',
          c.client || '',
          c.description || '',
          c.credits || '',
          c.link || '',
          c.caseStudyLink || '',
          c.clientLink || '',
          JSON.stringify(c.gallery || []),
          c.thumbnail || c.image,
          i,
          new Date().toISOString()
        ]
      });
    }
  }

  isSchemaInitialized = true;
}
