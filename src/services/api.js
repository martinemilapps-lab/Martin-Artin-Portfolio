/**
 * Centralized API Client for Martin Emil Arteen Portfolio
 * Communicates strictly with server-side /api/* endpoints.
 * Never connects directly to Turso from the browser.
 */

async function request(url, options = {}) {
  const defaultHeaders = {
    'Accept': 'application/json',
  };

  if (options.body && typeof options.body === 'object') {
    defaultHeaders['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Includes HttpOnly session cookie
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let errorMsg = `Request failed with status ${response.status}`;
    if (typeof data?.error === 'string') {
      errorMsg = data.error;
    } else if (typeof data?.error?.message === 'string') {
      errorMsg = data.error.message;
    } else if (typeof data?.message === 'string') {
      errorMsg = data.message;
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Authentication
  login: async (username, password) => {
    return request('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });
  },

  loginWithPasskey: async (passkey) => {
    return request('/api/auth/login', {
      method: 'POST',
      body: { passkey }
    });
  },

  logout: async () => {
    return request('/api/auth/logout', {
      method: 'POST'
    });
  },

  getSession: async () => {
    return request('/api/auth/session', {
      method: 'GET'
    });
  },

  generateAccessLink: async () => {
    return request('/api/auth/access-link', {
      method: 'POST',
      body: { action: 'generate' }
    });
  },

  consumeAccessLink: async (token) => {
    return request('/api/auth/access-link', {
      method: 'POST',
      body: { action: 'consume', token }
    });
  },

  // Public Campaigns
  getCampaigns: async () => {
    return request('/api/campaigns', {
      method: 'GET'
    });
  },

  // Admin Campaigns
  createCampaign: async (campaignData) => {
    return request('/api/admin/campaigns', {
      method: 'POST',
      body: campaignData
    });
  },

  updateCampaign: async (campaignData) => {
    const id = campaignData.id;
    return request(`/api/admin/campaigns?id=${id}`, {
      method: 'PUT',
      body: campaignData
    });
  },

  deleteCampaign: async (id) => {
    return request(`/api/admin/campaigns?id=${id}`, {
      method: 'DELETE'
    });
  },

  reorderCampaigns: async (campaignIds) => {
    return request('/api/admin/reorder', {
      method: 'POST',
      body: { campaignIds }
    });
  },

  importCampaigns: async (campaigns) => {
    return request('/api/admin/import', {
      method: 'POST',
      body: { campaigns }
    });
  },

  resetCampaigns: async () => {
    return request('/api/admin/reset', {
      method: 'POST'
    });
  },

  // Admin Security & Management
  changePassword: async (currentPassword, newPassword) => {
    return request('/api/admin/security', {
      method: 'POST',
      body: { currentPassword, newPassword }
    });
  },

  getHealth: async () => {
    return request('/api/admin/health', {
      method: 'GET'
    });
  },

  getAuditLogs: async () => {
    return request('/api/admin/audit-logs', {
      method: 'GET'
    });
  }
};
