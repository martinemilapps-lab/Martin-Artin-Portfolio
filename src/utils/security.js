/**
 * CLIENT-SIDE UI SANITIZATION & INPUT HELPERS
 * NOTE: The frontend is untrusted. All authorization, authentication,
 * and security validation are strictly enforced on the server.
 */

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
 * Validate and sanitize image URLs (allowing relative /campaigns/*, https:, and safe data:image/*)
 */
export function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '/campaigns/c1.jpg';
  const trimmed = url.trim();

  // Relative path to local campaigns
  if (trimmed.startsWith('/campaigns/') || trimmed.startsWith('./campaigns/') || trimmed.startsWith('campaigns/')) {
    return trimmed;
  }

  // Safe Web Protocols (Strict HTTPS preferred)
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Safe Data URIs (Images only)
  if (/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }

  return '/campaigns/c1.jpg';
}

/**
 * Validate uploaded image file (size, MIME type, and client SVG script scanning for UX feedback)
 */
export async function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
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

  // If SVG, perform preliminary client scan for UX
  if (file.type === 'image/svg+xml') {
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');

      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        return { valid: false, error: 'Malformed SVG file structure.' };
      }

      if (doc.querySelectorAll('script').length > 0) {
        return { valid: false, error: 'Security alert: Embedded scripts in SVG are strictly prohibited.' };
      }

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
 * Enforces HTTPS and rejects javascript: / data: schemes
 */
export function sanitizeExternalUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('https://') || trimmed.startsWith('/') || trimmed.startsWith('mailto:')) {
    return trimmed;
  }

  // If user typed domain like "behance.net/..." without https://, prepend https://
  if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return '';
}
