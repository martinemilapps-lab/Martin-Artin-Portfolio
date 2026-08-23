/**
 * PROJECT STORAGE & CAMPAIGNS DATA ENGINE
 * Uses Server API (Primary) + LocalStorage (Untrusted UI Cache) + Fallback
 */

import { campaignsData as initialDefaultCampaigns } from '../data/campaignsData';
import { sanitizeImageUrl, sanitizeExternalUrl } from './security';
import { api } from '../services/api';

export const CAMPAIGNS_STORAGE_KEY = 'mea_portfolio_campaigns_cache_v3';

/**
 * Validate campaign object schema (client-side preview check)
 */
export function validateCampaign(campaign) {
  if (!campaign || typeof campaign !== 'object') {
    return { valid: false, error: 'Project data must be a valid object.' };
  }

  if (!campaign.title || typeof campaign.title !== 'string' || !campaign.title.trim()) {
    return { valid: false, error: 'Project Title is required.' };
  }

  if (!campaign.tagline || typeof campaign.tagline !== 'string' || !campaign.tagline.trim()) {
    return { valid: false, error: 'Project Tagline is required.' };
  }

  if (!campaign.year || typeof campaign.year !== 'string' || !campaign.year.trim()) {
    return { valid: false, error: 'Project Year is required (e.g. 2026).' };
  }

  if (!campaign.role || typeof campaign.role !== 'string' || !campaign.role.trim()) {
    return { valid: false, error: 'Project Role is required (e.g. ART DIRECTION & CGI).' };
  }

  if (!campaign.category || typeof campaign.category !== 'string' || !campaign.category.trim()) {
    return { valid: false, error: 'Project Category is required (e.g. AUTOMOTIVE EXHIBITION).' };
  }

  if (!campaign.description || typeof campaign.description !== 'string' || !campaign.description.trim()) {
    return { valid: false, error: 'Project Description is required.' };
  }

  if (!campaign.credits || typeof campaign.credits !== 'string' || !campaign.credits.trim()) {
    return { valid: false, error: 'Project Credits are required.' };
  }

  return { valid: true };
}

/**
 * Format and sanitize a single campaign item
 */
export function sanitizeCampaign(campaign, fallbackIndex = 1) {
  const formattedId = campaign.id 
    ? String(campaign.id).padStart(2, '0') 
    : String(fallbackIndex).padStart(2, '0');

  let sanitizedGallery = [];
  if (Array.isArray(campaign.gallery)) {
    sanitizedGallery = campaign.gallery
      .map((item, idx) => {
        if (typeof item === 'string') {
          const clean = sanitizeImageUrl(item);
          return clean ? { id: `g_${idx}`, url: clean, caption: '' } : null;
        } else if (item && typeof item === 'object' && item.url) {
          return {
            id: item.id || `g_${idx}`,
            url: sanitizeImageUrl(item.url),
            caption: (item.caption || '').trim()
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  return {
    id: formattedId,
    title: (campaign.title || '').trim().toUpperCase(),
    tagline: (campaign.tagline || '').trim().toUpperCase(),
    year: (campaign.year || new Date().getFullYear().toString()).trim(),
    role: (campaign.role || 'ART DIRECTION & CGI').trim().toUpperCase(),
    status: (campaign.status || 'EXPERIMENTAL').trim().toUpperCase(),
    image: sanitizeImageUrl(campaign.image),
    category: (campaign.category || 'EXHIBITION').trim().toUpperCase(),
    client: (campaign.client || '').trim(),
    description: (campaign.description || '').trim(),
    credits: (campaign.credits || '').trim(),
    link: sanitizeExternalUrl(campaign.link),
    case_study_link: sanitizeExternalUrl(campaign.case_study_link || campaign.caseStudyLink),
    caseStudyLink: sanitizeExternalUrl(campaign.case_study_link || campaign.caseStudyLink),
    client_link: sanitizeExternalUrl(campaign.client_link || campaign.clientLink),
    clientLink: sanitizeExternalUrl(campaign.client_link || campaign.clientLink),
    gallery: sanitizedGallery,
    thumbnail: sanitizeImageUrl(campaign.thumbnail || campaign.image),
    displayOrder: typeof campaign.displayOrder === 'number' ? campaign.displayOrder : 0
  };
}

/**
 * Load campaigns from local untrusted cache or seed data (instant initial paint)
 */
export function loadCampaigns() {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => sanitizeCampaign(item, idx + 1));
      }
    }
  } catch (e) {
    console.warn('Could not read cached campaigns from localStorage:', e);
  }

  return initialDefaultCampaigns.map((item, idx) => sanitizeCampaign(item, idx + 1));
}

/**
 * Fetch fresh campaigns from Server API and update local untrusted cache
 */
export async function syncCampaignsFromTurso() {
  try {
    const result = await api.getCampaigns();
    if (result && Array.isArray(result.campaigns) && result.campaigns.length > 0) {
      const sanitized = result.campaigns.map((item, idx) => sanitizeCampaign(item, idx + 1));
      try {
        localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(sanitized));
      } catch (err) {
        console.warn('Cache write failed:', err);
      }
      return { success: true, campaigns: sanitized, source: 'server' };
    }
  } catch (e) {
    console.warn('syncCampaigns from server API failed, using cached fallback:', e);
  }

  return { success: false, campaigns: loadCampaigns(), source: 'cache' };
}

/**
 * Save campaigns array through Server API and update local cache
 */
export async function saveCampaigns(campaigns, syncCloud = true) {
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return { success: false, error: 'Campaigns array cannot be empty.' };
  }

  const sanitized = campaigns.map((item, idx) => sanitizeCampaign(item, idx + 1));

  try {
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.warn('LocalStorage write error:', e);
  }

  if (syncCloud) {
    try {
      await api.importCampaigns(sanitized);
      return { success: true, count: sanitized.length, cloudSynced: true };
    } catch (e) {
      console.error('Server sync error on save:', e);
      return { success: false, count: sanitized.length, cloudSynced: false, error: e.message };
    }
  }

  return { success: true, count: sanitized.length, cloudSynced: false };
}

/**
 * Reset campaigns back to factory defaults via Server API
 */
export async function resetCampaignsToDefault(syncCloud = true) {
  const defaults = initialDefaultCampaigns.map((item, idx) => sanitizeCampaign(item, idx + 1));

  try {
    localStorage.removeItem(CAMPAIGNS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to reset local cache:', e);
  }

  if (syncCloud) {
    try {
      await api.resetCampaigns();
    } catch (e) {
      console.warn('Server reset sync error:', e);
    }
  }

  return defaults;
}

/**
 * Generate formatted campaignsData.js code string for direct git commit
 */
export function generateCampaignsDataJsCode(campaigns) {
  const sanitized = campaigns.map((item, idx) => sanitizeCampaign(item, idx + 1));
  
  const entries = sanitized.map(c => `  {
    id: '${c.id}',
    title: '${c.title.replace(/'/g, "\\'")}',
    tagline: '${c.tagline.replace(/'/g, "\\'")}',
    year: '${c.year.replace(/'/g, "\\'")}',
    role: '${c.role.replace(/'/g, "\\'")}',
    status: '${c.status.replace(/'/g, "\\'")}',
    image: '${c.image.replace(/'/g, "\\'")}',
    category: '${c.category.replace(/'/g, "\\'")}',
    client: '${(c.client || '').replace(/'/g, "\\'")}',
    description: '${c.description.replace(/'/g, "\\'")}',
    credits: '${c.credits.replace(/'/g, "\\'")}',
    link: '${(c.link || '').replace(/'/g, "\\'")}',
    case_study_link: '${(c.case_study_link || '').replace(/'/g, "\\'")}',
    client_link: '${(c.client_link || '').replace(/'/g, "\\'")}',
    gallery: ${JSON.stringify(c.gallery || [])},
    thumbnail: '${(c.thumbnail || '').replace(/'/g, "\\'")}'
  }`).join(',\n');

  return `export const campaignsData = [\n${entries}\n];\n`;
}

/**
 * Trigger browser file download
 */
export function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export campaigns as downloadable campaignsData.js file
 */
export function exportCampaignsJS(campaigns) {
  const code = generateCampaignsDataJsCode(campaigns);
  downloadFile(code, 'campaignsData.js', 'text/javascript;charset=utf-8');
}

/**
 * Export campaigns as JSON backup file
 */
export function exportCampaignsJSON(campaigns) {
  const payload = {
    version: '3.0',
    exportDate: new Date().toISOString(),
    author: 'Martin Emil Arteen Portfolio Admin',
    campaigns: campaigns.map((item, idx) => sanitizeCampaign(item, idx + 1))
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  downloadFile(jsonStr, `mea-campaigns-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8');
}

/**
 * Import campaigns from JSON backup text and sync with server
 */
export async function importCampaignsJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    let items = null;

    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && Array.isArray(parsed.campaigns)) {
      items = parsed.campaigns;
    }

    if (!items || items.length === 0) {
      return { success: false, error: 'Imported file contains no valid campaigns array.' };
    }

    for (let i = 0; i < items.length; i++) {
      const val = validateCampaign(items[i]);
      if (!val.valid) {
        return { success: false, error: `Error in project #${i + 1}: ${val.error}` };
      }
    }

    const sanitized = items.map((item, idx) => sanitizeCampaign(item, idx + 1));
    const result = await saveCampaigns(sanitized, true);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to sync imported campaigns with server.' };
    }

    return { success: true, count: sanitized.length, campaigns: sanitized };
  } catch (e) {
    return { success: false, error: `Invalid JSON format: ${e.message}` };
  }
}
