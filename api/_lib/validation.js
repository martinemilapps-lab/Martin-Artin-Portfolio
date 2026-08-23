/**
 * Parse request body safely supporting parsed objects, JSON strings, and unbuffered streams
 */
export async function parseBody(req) {
  if (!req) return {};
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  if (typeof req.on === 'function' && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      if (buffers.length === 0) return {};
      const raw = Buffer.concat(buffers).toString('utf8');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  return {};
}

/**
 * Validate and sanitize external or internal URLs
 */
export function validateUrl(rawUrl, fieldName = 'URL') {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Allow internal relative paths
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Parse as URL
  try {
    const parsed = new URL(trimmed);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== 'https:') {
      throw new Error(`${fieldName} must use secure HTTPS protocol.`);
    }

    // Reject dangerous schemes or hostnames
    if (['javascript:', 'data:', 'vbscript:', 'file:', 'blob:'].includes(protocol)) {
      throw new Error(`Dangerous protocol detected in ${fieldName}.`);
    }

    return parsed.toString();
  } catch (err) {
    if (err.message.includes('protocol') || err.message.includes('Dangerous')) {
      throw err;
    }
    throw new Error(`Invalid URL format for ${fieldName}.`);
  }
}

/**
 * Sanitize and validate SVG content
 */
export function sanitizeSvg(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return '';

  // Check for dangerous scripts, event handlers, or tags
  const dangerousPatterns = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<script/gi,
    /<\/script>/gi,
    /\bon\w+\s*=/gi, // onload=, onerror=, onclick=, etc.
    /javascript:/gi,
    /vbscript:/gi,
    /<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi,
    /<iframe/gi,
    /<embed/gi,
    /<object/gi
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(svgContent)) {
      throw new Error('Security violation: SVG contains disallowed active content or executable scripts.');
    }
  }

  return svgContent;
}

/**
 * Validate an image string (HTTPS URL or Data URI under 10MB)
 */
export function validateImage(imageStr, fieldName = 'Image') {
  if (!imageStr || typeof imageStr !== 'string') {
    throw new Error(`${fieldName} is required.`);
  }

  const trimmed = imageStr.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  // If Data URI, validate size and mime type
  if (trimmed.startsWith('data:image/')) {
    // 10MB payload limit (approx 13.5MB base64 string)
    if (trimmed.length > 14 * 1024 * 1024) {
      throw new Error(`${fieldName} exceeds the maximum allowed file size of 10MB.`);
    }

    if (trimmed.startsWith('data:image/svg+xml')) {
      try {
        const svgBody = trimmed.includes('base64,')
          ? Buffer.from(trimmed.split('base64,')[1], 'base64').toString('utf8')
          : decodeURIComponent(trimmed.split('data:image/svg+xml,')[1] || '');
        sanitizeSvg(svgBody);
      } catch (err) {
        throw new Error(`SVG Validation Failed: ${err.message}`);
      }
    }

    return trimmed;
  }

  // Validate as HTTPS URL
  return validateUrl(trimmed, fieldName);
}

/**
 * Validate and sanitize full campaign payload
 */
export function validateCampaignInput(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid campaign payload: must be a JSON object.');
  }

  // Guard against prototype pollution
  const cleanData = Object.create(null);
  for (const key of Object.keys(data)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    cleanData[key] = data[key];
  }

  // Required title
  const title = String(cleanData.title || '').trim();
  if (!title) {
    throw new Error('Campaign title is required.');
  }
  if (title.length > 200) {
    throw new Error('Campaign title exceeds maximum length of 200 characters.');
  }

  // Tagline
  const tagline = String(cleanData.tagline || '').trim();
  if (tagline.length > 500) {
    throw new Error('Campaign tagline exceeds maximum length of 500 characters.');
  }

  // Year
  const year = String(cleanData.year || '').trim().slice(0, 50);

  // Role
  const role = String(cleanData.role || '').trim().slice(0, 100);

  // Status
  const status = String(cleanData.status || '').trim().slice(0, 50);

  // Category
  const category = String(cleanData.category || '').trim().slice(0, 100);

  // Client
  const client = String(cleanData.client || '').trim().slice(0, 150);

  // Description
  const description = String(cleanData.description || '').trim();
  if (description.length > 5000) {
    throw new Error('Campaign description exceeds maximum length of 5000 characters.');
  }

  // Credits
  const credits = String(cleanData.credits || '').trim();
  if (credits.length > 2000) {
    throw new Error('Campaign credits exceed maximum length of 2000 characters.');
  }

  // Validate Image
  const image = validateImage(cleanData.image, 'Hero Image');

  // Validate Thumbnail (fallback to image if missing)
  const thumbnail = cleanData.thumbnail
    ? validateImage(cleanData.thumbnail, 'Thumbnail')
    : image;

  // Validate URLs
  const link = validateUrl(cleanData.link, 'Campaign Link');
  const caseStudyLink = validateUrl(cleanData.caseStudyLink || cleanData.case_study_link, 'Case Study Link');
  const clientLink = validateUrl(cleanData.clientLink || cleanData.client_link, 'Client Link');

  // Validate Gallery Array
  let gallery = [];
  if (Array.isArray(cleanData.gallery)) {
    if (cleanData.gallery.length > 30) {
      throw new Error('Gallery cannot contain more than 30 images.');
    }

    gallery = cleanData.gallery.map((item, idx) => {
      if (typeof item === 'string') {
        return {
          id: `g_${Date.now()}_${idx}`,
          url: validateImage(item, `Gallery Image #${idx + 1}`),
          caption: ''
        };
      }
      if (item && typeof item === 'object') {
        return {
          id: String(item.id || `g_${Date.now()}_${idx}`).slice(0, 50),
          url: validateImage(item.url, `Gallery Image #${idx + 1}`),
          caption: String(item.caption || '').trim().slice(0, 300)
        };
      }
      throw new Error(`Invalid item in gallery at index ${idx}.`);
    });
  }

  return {
    id: cleanData.id ? Number(cleanData.id) : undefined,
    title,
    tagline,
    year,
    role,
    status,
    image,
    category,
    client,
    description,
    credits,
    link,
    caseStudyLink,
    clientLink,
    gallery,
    thumbnail,
    displayOrder: typeof cleanData.displayOrder === 'number' ? cleanData.displayOrder : 0
  };
}
